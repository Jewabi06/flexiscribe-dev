import { NextRequest, NextResponse } from 'next/server';
import { checkOllamaAvailability, getAvailableModels, getBestAvailableModel } from '@/lib/ollama';

export async function GET(request: NextRequest) {
  try {
    const isAvailable = await checkOllamaAvailability();
    
    if (!isAvailable) {
      return NextResponse.json({
        success: false,
        error: 'Ollama is not running. Please start it with: ollama serve',
      });
    }

    const models = await getAvailableModels();
    const bestModel = await getBestAvailableModel();

    return NextResponse.json({
      success: true,
      ollamaRunning: true,
      availableModels: models,
      recommendedModel: bestModel,
      message: models.length === 0 
        ? 'No models found. Pull a model with: ollama pull gemma2:2b'
        : `Found ${models.length} model(s). Using: ${bestModel}`,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to check Ollama status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
