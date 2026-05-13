<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\LandingPageBlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LandingPageBlockController extends Controller
{
    /**
     * Get all blocks for a landing page
     */
    public function index(Request $request, LandingPage $landingPage): JsonResponse
    {
        $this->authorize('view', $landingPage);

        $blocks = $landingPage->blocks()
            ->whereNull('parent_block_id')
            ->orderBy('sort_order')
            ->with('childBlocks')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $blocks,
        ]);
    }

    /**
     * Create a new block
     */
    public function store(Request $request, LandingPage $landingPage): JsonResponse
    {
        $this->authorize('update', $landingPage);

        $validated = $request->validate([
            'block_type' => ['required', 'string', 'max:60'],
            'parent_block_id' => ['nullable', 'integer', 'exists:landing_page_blocks,id'],
            'locked' => ['boolean'],
            'visibility_rules_json' => ['nullable', 'array'],
            'settings_json' => ['nullable', 'array'],
            'content_json' => ['nullable', 'array'],
        ]);

        // Generate unique block key
        $blockKey = Str::slug($validated['block_type']) . '-' . Str::random(8);

        // Calculate sort order
        $query = $landingPage->blocks();
        if ($validated['parent_block_id'] ?? null) {
            $query->where('parent_block_id', $validated['parent_block_id']);
        } else {
            $query->whereNull('parent_block_id');
        }
        $nextOrder = ($query->max('sort_order') ?? 0) + 1;

        $block = LandingPageBlock::create([
            'landing_page_id' => $landingPage->id,
            'block_key' => $blockKey,
            'block_type' => $validated['block_type'],
            'parent_block_id' => $validated['parent_block_id'] ?? null,
            'sort_order' => $nextOrder,
            'locked' => $validated['locked'] ?? false,
            'visibility_rules_json' => $validated['visibility_rules_json'] ?? [],
            'settings_json' => $validated['settings_json'] ?? [],
            'content_json' => $validated['content_json'] ?? [],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Block created successfully',
            'data' => $block,
        ], 201);
    }

    /**
     * Update a block
     */
    public function update(Request $request, LandingPage $landingPage, LandingPageBlock $block): JsonResponse
    {
        $this->authorize('update', $landingPage);

        if ($block->landing_page_id !== $landingPage->id) {
            return response()->json([
                'success' => false,
                'message' => 'Block does not belong to this page',
            ], 404);
        }

        $validated = $request->validate([
            'locked' => ['boolean'],
            'visibility_rules_json' => ['nullable', 'array'],
            'settings_json' => ['nullable', 'array'],
            'content_json' => ['nullable', 'array'],
        ]);

        $block->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Block updated successfully',
            'data' => $block,
        ]);
    }

    /**
     * Delete a block
     */
    public function destroy(Request $request, LandingPage $landingPage, LandingPageBlock $block): JsonResponse
    {
        $this->authorize('update', $landingPage);

        if ($block->landing_page_id !== $landingPage->id) {
            return response()->json([
                'success' => false,
                'message' => 'Block does not belong to this page',
            ], 404);
        }

        $block->delete();

        return response()->json([
            'success' => true,
            'message' => 'Block deleted successfully',
        ]);
    }

    /**
     * Reorder blocks
     */
    public function reorder(Request $request, LandingPage $landingPage): JsonResponse
    {
        $this->authorize('update', $landingPage);

        $validated = $request->validate([
            'blocks' => ['required', 'array'],
            'blocks.*.id' => ['required', 'integer', 'exists:landing_page_blocks,id'],
            'blocks.*.order' => ['required', 'integer', 'min:1'],
        ]);

        foreach ($validated['blocks'] as $blockData) {
            LandingPageBlock::where('id', $blockData['id'])
                ->where('landing_page_id', $landingPage->id)
                ->update(['sort_order' => $blockData['order']]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Blocks reordered successfully',
        ]);
    }

    /**
     * Duplicate a block
     */
    public function duplicate(Request $request, LandingPage $landingPage, LandingPageBlock $block): JsonResponse
    {
        $this->authorize('update', $landingPage);

        if ($block->landing_page_id !== $landingPage->id) {
            return response()->json([
                'success' => false,
                'message' => 'Block does not belong to this page',
            ], 404);
        }

        $newBlock = $block->replicate();
        $newBlock->block_key = Str::slug($block->block_type) . '-' . Str::random(8);
        $newBlock->sort_order = $block->sort_order + 1;
        $newBlock->save();

        return response()->json([
            'success' => true,
            'message' => 'Block duplicated successfully',
            'data' => $newBlock,
        ], 201);
    }
}
