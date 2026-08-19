# Testing a live WordPress/WooCommerce site via SSH — Method

How to investigate a real seller's live WordPress site when they grant SSH
access, used first on 2026-08-19 to track down why `bsol-connect`'s payment
gateways weren't showing on `zisan.me` (see `wordpress_connect_context.md`
§12's "ফিক্স (v1.19.4...)" for that specific investigation's findings).
This dev environment has no WordPress/WooCommerce install of its own
(`wordpress_connect_context.md` §6), so this is the only way to get real
ground truth instead of guessing at another theoretical fix.

## Before connecting

- Get from the user: host, port, username, auth method (password or key).
  Don't guess/brute-force credentials — a wrong password retried blindly
  risks tripping fail2ban and locking the user out of their own server.
- Default to **read-only investigation**. Writing to their live production
  files (even a well-verified fix) is a bigger ask than "look around" —
  say explicitly what you're about to change before doing it, same as any
  other outward-facing/hard-to-reverse action.
- Treat anything typed into chat as a real password for a real production
  server — don't echo it back, and delete any file you had to write it
  into as soon as you're done with it (see Cleanup below).

## Connecting without an interactive TTY (password auth, no `sshpass`)

This environment doesn't have `sshpass` installed, and installing it needs
`sudo` (not available passwordless here) or a working `pip`/`apt` (also
not available in this box's minimal setup). Don't fight that — `ssh`'s own
`SSH_ASKPASS` mechanism works without any extra package:

```bash
# One-time per session — write the password to a small askpass helper.
# Keep this in the scratchpad dir, never the repo.
cat > /tmp/.../scratchpad/askpass.sh << 'EOF'
#!/bin/sh
echo "THE_PASSWORD"
EOF
chmod +x /tmp/.../scratchpad/askpass.sh

# Then every ssh/scp call:
SSH_ASKPASS=/tmp/.../scratchpad/askpass.sh \
SSH_ASKPASS_REQUIRE=force \
DISPLAY=:0 \
setsid ssh -o StrictHostKeyChecking=accept-new \
  -o PreferredAuthentications=password -o PubkeyAuthentication=no \
  -p <port> <user>@<host> "<command>" < /dev/null
```

Why each piece matters:
- `SSH_ASKPASS_REQUIRE=force` + `DISPLAY=:0` (any value) — tricks `ssh`
  into using the askpass helper even though there's no real X session.
  Without `DISPLAY` set, `ssh` won't try askpass at all.
- `setsid` — detaches from the controlling terminal so `ssh` can't fall
  back to an interactive tty prompt (which would just hang, since this
  tool has no way to answer one).
- `< /dev/null` — belt-and-suspenders, same reason.
- `-o PreferredAuthentications=password -o PubkeyAuthentication=no` —
  skips trying every local identity file first (there usually are none
  relevant, but this avoids wasted round-trips and ambiguous prompts).
- `-o StrictHostKeyChecking=accept-new` — accepts a new host key
  automatically (fine for a host the user just told you to connect to),
  without silently accepting a *changed* key for a previously-known host.

Wrap the repeated part in a small helper script once connected successfully:

```bash
cat > /tmp/.../scratchpad/ssh_run.sh << 'WRAP'
#!/bin/bash
SSH_ASKPASS=/tmp/.../scratchpad/askpass.sh \
SSH_ASKPASS_REQUIRE=force \
DISPLAY=:0 \
setsid ssh -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password -o PubkeyAuthentication=no -p <port> <user>@<host> "$1" < /dev/null
WRAP
chmod +x /tmp/.../scratchpad/ssh_run.sh
```

Then every subsequent command is just `./ssh_run.sh "some remote command"`.
The same `SSH_ASKPASS=...` prefix works for `scp` too (see "Copying a fix
over for live verification" below) — just swap `ssh` for `scp -P <port>`.

If output looks empty/truncated when piping through `tail`/`cat` in the
same call, redirect to a file and read it with the Read tool instead —
some combinations of `setsid` + pipe buffering in this harness don't play
well together, but redirecting to a file always works.

## Finding the real PHP/WP-CLI setup

Don't assume `php`/`wp` on PATH is what actually serves the site:

```bash
./ssh_run.sh "php -v"                          # CLI default — may be a different version than the site uses
./ssh_run.sh "which wp"                          # WP-CLI is usually /usr/local/bin/wp, a PHP phar
./ssh_run.sh "update-alternatives --list php"    # all installed PHP versions
./ssh_run.sh "for v in 8.2 8.3 8.4 8.5; do echo --php\$v--; php\$v -m 2>/dev/null | grep -i mysqli; done"
```

Real gotcha hit on the first use of this method: the box had PHP 8.2–8.5
installed, but the CLI default (`php` → 8.5) was missing the `mysqli`
extension, so plain `wp <anything>` failed with "missing the MySQL
extension" — even though the actual site (via PHP-FPM, a different pool)
worked fine. `WP_CLI_PHP=/usr/bin/php8.4 wp ...` did **not** fix this
(`wp`'s shebang is `#!/usr/bin/env php`, which some `wp` builds honor for
`WP_CLI_PHP` and some don't). What reliably works: bypass the shebang
entirely and invoke the phar directly with the working PHP binary:

```bash
./ssh_run.sh "cd /path/to/site && php8.4 /usr/local/bin/wp plugin list --allow-root"
```

To find which PHP-FPM pool actually serves the site (for cross-checking,
not usually needed once the above works): `ps aux | grep -E 'nginx|apache|litespeed'`,
then read the vhost config (`/etc/apache2/sites-enabled/*.conf` or
`/etc/nginx/sites-enabled/*`) for the relevant domain.

## Introspecting the live PHP/WordPress state

`wp eval '<php code>'` is the single most useful tool here — it runs real
PHP inside a fully-bootstrapped WordPress request, so you can check
exactly what the actual site sees, not what the code *should* do in
theory:

```bash
./ssh_run.sh "cd /path/to/site && php8.4 /usr/local/bin/wp eval '
echo \"api_key set: \" . (get_option(\"bsol_api_key\") ? \"yes\" : \"no\") . PHP_EOL;
echo \"SomeClass loaded: \" . (class_exists(\"SomeClass\") ? \"yes\" : \"no\") . PHP_EOL;
echo \"did_action(some_hook): \" . did_action(\"some_hook\") . PHP_EOL;
echo \"transient: \" . print_r(get_transient(\"some_key\"), true) . PHP_EOL;
\$gateways = WC()->payment_gateways()->payment_gateways();
echo \"registered: \" . implode(\",\", array_keys(\$gateways)) . PHP_EOL;
' --allow-root 2>&1"
```

This is exactly how the `woocommerce_loaded`-already-fired bug got found:
`class_exists('Bsol_Payment_Gateway')` was `false` and
`did_action('woocommerce_loaded')` was `1` — both facts that would have
taken several more guess-a-fix/ask-user-to-reinstall/wait-for-report
round-trips to reach any other way.

`--allow-root` is needed since these connections are typically root SSH.
Expect noisy unrelated warning output mixed in from other active plugins
(Elementor logging deprecation notices, etc.) — `grep -v` it out or just
read past it.

## Reading logs without being drowned by unrelated noise

A shared Apache/Nginx error log on a real host often carries traffic from
*other* sites/apps on the same box. Don't trust `tail -N | grep` — it can
miss the entries you need if a noisy unrelated app dominates the recent
tail. Grep the **whole file** for something specific to the site/plugin
first:

```bash
./ssh_run.sh "grep -i 'the-plugin-slug' /var/log/apache2/error.log | wc -l"   # count first
./ssh_run.sh "grep -i 'the-site-domain' /var/log/apache2/error.log | tail -60"
```

A large hit count on the site's own domain but zero on the plugin's own
slug is itself informative — it can mean the plugin's code never actually
threw an error (ruling out a fatal-error theory), which is exactly what
redirected the 2026-08-19 investigation from "is it crashing" to "is it
loading at all" (via the `wp eval class_exists` check above).

Also worth checking: `wp-config.php`'s `WP_DEBUG`/`WP_DEBUG_LOG` settings
and `wp-content/debug.log`'s last-modified date — a debug.log that hasn't
been touched in months means it isn't actively capturing anything right
now, regardless of what's configured.

## Copying a fix over for live verification (only with explicit go-ahead)

Once a fix is written and linted locally, it can be verified directly
against the real bug before committing anything, by copying just the
changed file over and re-running the same `wp eval` check:

```bash
SSH_ASKPASS=/tmp/.../scratchpad/askpass.sh SSH_ASKPASS_REQUIRE=force DISPLAY=:0 \
setsid scp -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no -P <port> \
  local/path/to/fixed-file.php \
  <user>@<host>:/path/to/site/wp-content/plugins/the-plugin/fixed-file.php < /dev/null
```

Then re-run the same diagnostic `wp eval` to confirm the fix actually
changes the observed behavior — not just that it *should* in theory.
This turned a 4th "reinstall and tell me what you see" round-trip into a
same-turn confirmed fix. Only do this once the user has actually granted
SSH access for the purpose of fixing (not just "look around") — it's
writing to their live production site.

After confirming, still commit the real fix to the repo/plugin package
normally so the *next* fresh download matches what's already live on that
one patched site.

## Cleanup — every time, no exceptions

The askpass helper file contains the password in plaintext. Delete it
(and any raw ssh output files that might have captured banner/debug text)
as soon as the session's SSH work is done:

```bash
shred -u /tmp/.../scratchpad/askpass.sh 2>/dev/null || rm -f /tmp/.../scratchpad/askpass.sh
rm -f /tmp/.../scratchpad/ssh_run.sh /tmp/.../scratchpad/*ssh_out*.log
```

Never commit any of these helper files to the repo, and never leave one
sitting in the scratchpad past the session that needed it.
