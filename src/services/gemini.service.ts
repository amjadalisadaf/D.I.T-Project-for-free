import { Injectable, signal } from '@angular/core';
// FIX: Remove invalid VideosOperationResponse import and add GroundingChunk from the SDK.
import { GoogleGenAI, GenerateVideosOperation, GroundingChunk } from '@google/genai';

// FIX: Remove local GroundingChunk interface to resolve type conflict with the SDK.
/*
export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}
*/

export interface GenerationResult {
  text: string;
  sources: GroundingChunk[];
}

export interface GeneratedImage {
  imageBytes: string;
}


@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private genAI: GoogleGenAI | null = null;
  private apiKey = signal<string | undefined>(process.env.API_KEY);

  constructor() {
    const key = this.apiKey();
    if (key) {
        this.genAI = new GoogleGenAI({ apiKey: key });
    } else {
        console.error('API Key not found. Please set the API_KEY environment variable.');
    }
  }

  async generateContentWithSearch(prompt: string): Promise<GenerationResult> {
    if (!this.genAI) {
      throw new Error('Gemini AI Client is not initialized. Check API Key.');
    }

    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text;
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const sources: GroundingChunk[] = groundingMetadata?.groundingChunks || [];

      return { text, sources };
    } catch (error) {
      console.error('Error generating content:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred with the API.';
      throw new Error(`Failed to generate content: ${errorMessage}`);
    }
  }

  async generateImage(prompt: string): Promise<GeneratedImage[]> {
    if (!this.genAI) {
      throw new Error('Gemini AI Client is not initialized. Check API Key.');
    }
    try {
      const response = await this.genAI.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
      });
      // FIX: Safely map and filter images, ensuring imageBytes exists to match the GeneratedImage interface.
      const images: GeneratedImage[] = [];
      for (const generatedImage of response.generatedImages) {
        if (generatedImage.image?.imageBytes) {
          images.push({ imageBytes: generatedImage.image.imageBytes });
        }
      }
      return images;
    } catch (error) {
      console.error('Error generating image:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred with the API.';
      throw new Error(`Failed to generate image: ${errorMessage}`);
    }
  }

  async generateVideo(
    prompt: string, 
    image: { imageBytes: string; mimeType: string },
    aspectRatio: '16:9' | '9:16'
  ): Promise<GenerateVideosOperation> {
    if (!this.genAI) {
      throw new Error('Gemini AI Client is not initialized. Check API Key.');
    }
    try {
      const operation = await this.genAI.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt,
        image,
        config: {
          numberOfVideos: 1,
          aspectRatio,
        }
      });
      return operation;
    } catch (error) {
      console.error('Error starting video generation:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred with the API.';
      throw new Error(`Failed to start video generation: ${errorMessage}`);
    }
  }
  
  // FIX: Change return type as GenerateVideosOperation is not a generic type.
  async getVideosOperation(operation: GenerateVideosOperation): Promise<GenerateVideosOperation> {
    if (!this.genAI) {
      throw new Error('Gemini AI Client is not initialized. Check API Key.');
    }
    try {
        const updatedOperation = await this.genAI.operations.getVideosOperation({ operation });
        return updatedOperation;
    } catch (error) {
        console.error('Error polling video operation:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred with the API.';
        throw new Error(`Failed to poll video operation: ${errorMessage}`);
    }
  }
}