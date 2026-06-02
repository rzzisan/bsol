<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Services\LandingPageEditorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LandingPageEditorController extends Controller
{
    private LandingPageEditorService $editorService;

    public function __construct(LandingPageEditorService $editorService)
    {
        $this->editorService = $editorService;
    }

    /**
     * GET /api/landing/editor/{pageId}
     * Get editor draft
     */
    public function getDraft(int $pageId): JsonResponse
    {
        $page = LandingPage::findOrFail($pageId);
        $this->authorize('update', $page);

        $draft = $this->editorService->getDraft($pageId, auth()->id());

        return response()->json([
            'success' => true,
            'data' => $draft,
        ]);
    }

    /**
     * POST /api/landing/editor/{pageId}/save
     * Save draft (auto-save)
     */
    public function saveDraft(Request $request, int $pageId): JsonResponse
    {
        $page = LandingPage::findOrFail($pageId);
        $this->authorize('update', $page);

        $validated = $request->validate([
            'components_json' => 'nullable|string',
            'styles_json' => 'nullable|string',
            'html_output' => 'nullable|string',
            'css_output' => 'nullable|string',
            'metadata' => 'nullable|array',
        ]);

        $draft = $this->editorService->saveDraft($pageId, auth()->id(), $validated);

        return response()->json([
            'success' => true,
            'message' => 'Draft saved successfully',
            'data' => $draft,
        ]);
    }

    /**
     * POST /api/landing/editor/{pageId}/publish
     * Publish page
     */
    public function publishPage(int $pageId): JsonResponse
    {
        $page = LandingPage::findOrFail($pageId);
        $this->authorize('update', $page);

        $publishedPage = $this->editorService->publishDraft($pageId, auth()->id());

        return response()->json([
            'success' => true,
            'message' => 'Page published successfully',
            'data' => $publishedPage,
        ]);
    }

    /**
     * GET /api/landing/editor/{pageId}/versions
     * Get version history
     */
    public function getVersions(int $pageId): JsonResponse
    {
        $page = LandingPage::findOrFail($pageId);
        $this->authorize('view', $page);

        $versions = $this->editorService->getVersions($pageId);

        return response()->json([
            'success' => true,
            'data' => $versions,
        ]);
    }

    /**
     * POST /api/landing/editor/{pageId}/rollback/{versionNumber}
     * Rollback to version
     */
    public function rollbackToVersion(int $pageId, int $versionNumber): JsonResponse
    {
        $page = LandingPage::findOrFail($pageId);
        $this->authorize('update', $page);

        $draft = $this->editorService->rollbackToVersion($pageId, auth()->id(), $versionNumber);

        return response()->json([
            'success' => true,
            'message' => 'Rolled back to version ' . $versionNumber,
            'data' => $draft,
        ]);
    }
}
