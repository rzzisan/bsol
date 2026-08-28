<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AiKnowledgeBaseArticle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin CRUD for the AI agent's platform how-to knowledge base —
 * support_ticketing_ai_context.md.
 */
class AiKnowledgeBaseArticleController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => AiKnowledgeBaseArticle::orderBy('sort_order')->orderBy('id')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $article = AiKnowledgeBaseArticle::create($data + ['updated_by' => auth()->id()]);

        return response()->json(['success' => true, 'data' => $article]);
    }

    public function update(Request $request, AiKnowledgeBaseArticle $article): JsonResponse
    {
        $data = $this->validated($request, $article->id);

        $article->update($data + ['updated_by' => auth()->id()]);

        return response()->json(['success' => true, 'data' => $article->fresh()]);
    }

    public function destroy(AiKnowledgeBaseArticle $article): JsonResponse
    {
        $article->delete();

        return response()->json(['success' => true]);
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'slug' => ['required', 'string', 'max:100', 'alpha_dash', Rule::unique('ai_knowledge_base_articles', 'slug')->ignore($ignoreId)],
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string', 'max:8000'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);
    }
}
