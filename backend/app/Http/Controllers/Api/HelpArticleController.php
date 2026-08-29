<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiKnowledgeBaseArticle;
use Illuminate\Http\JsonResponse;

/**
 * Read-only, seller-facing lookup into the same knowledge base the AI
 * support agent searches (support_ticketing_ai_context.md) — powers the
 * per-page "how do I use this?" help button. Deliberately just a single
 * slug lookup, not a search — the frontend already knows which article
 * belongs to which page (page-help-button.tsx's ROUTE_TO_SLUG map).
 */
class HelpArticleController extends Controller
{
    public function show(string $slug): JsonResponse
    {
        $article = AiKnowledgeBaseArticle::where('slug', $slug)->where('is_active', true)->first();

        if ($article === null) {
            return response()->json(['success' => false], 404);
        }

        return response()->json(['success' => true, 'data' => ['title' => $article->title, 'content' => $article->content]]);
    }
}
