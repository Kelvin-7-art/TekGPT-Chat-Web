import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerChatRoutes } from "./replit_integrations/chat";

// Define interfaces for the request/response
interface VisionRequest {
  imageBase64: string;
  prompt?: string;
}

interface OllamaResponse {
  response: string;
  error?: string;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register chat integration routes
  registerChatRoutes(app);

  // 🖼️ LLaVA Vision API Endpoint
  app.post('/api/vision/analyze', async (req, res) => {
    try {
      const { imageBase64, prompt } = req.body as VisionRequest;

      // Validate input
      if (!imageBase64) {
        return res.status(400).json({ 
          error: 'Missing image data. Please provide imageBase64.' 
        });
      }

      // Check if Ollama is running
      try {
        const healthCheck = await fetch('http://localhost:11434/api/tags', {
          signal: AbortSignal.timeout(2000)
        });
        
        if (!healthCheck.ok) {
          throw new Error('Ollama service is not responding');
        }
      } catch (error) {
        return res.status(503).json({ 
          error: 'Ollama service is not available. Please make sure Ollama is running (ollama serve).',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Send request to Ollama
      const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llava',
          prompt: prompt || "What's in this image? Describe it in detail.",
          images: [imageBase64],
          stream: false
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!ollamaResponse.ok) {
        const errorText = await ollamaResponse.text();
        throw new Error(`Ollama API error: ${ollamaResponse.status} - ${errorText}`);
      }

      const data = await ollamaResponse.json() as OllamaResponse;
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Return successful response
      res.json({ 
        success: true,
        description: data.response || 'No description generated',
        model: 'llava',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Vision API error:', error);
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
          return res.status(504).json({ 
            error: 'Image analysis timed out. Please try a smaller image or simpler prompt.',
            details: error.message
          });
        }
        
        if (error.message.includes('ECONNREFUSED')) {
          return res.status(503).json({ 
            error: 'Cannot connect to Ollama. Please run "ollama serve" in a terminal.',
            details: error.message
          });
        }
      }

      res.status(500).json({ 
        error: 'Failed to analyze image',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 🧪 Test endpoint to check if Ollama is available
  app.get('/api/vision/health', async (req, res) => {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(2000)
      });
      
      if (response.ok) {
        const data = await response.json();
        res.json({ 
          status: 'healthy', 
          models: data.models || [],
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({ 
          status: 'unhealthy', 
          error: 'Ollama service returned error'
        });
      }
    } catch (error) {
      res.status(503).json({ 
        status: 'unhealthy', 
        error: 'Ollama service not available',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 📸 Test endpoint for quick image analysis
  app.post('/api/vision/describe', async (req, res) => {
    try {
      const { imageBase64 } = req.body as VisionRequest;
      
      if (!imageBase64) {
        return res.status(400).json({ error: 'Missing image data' });
      }

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llava',
          prompt: 'Describe this image in 1-2 sentences.',
          images: [imageBase64],
          stream: false
        }),
        signal: AbortSignal.timeout(10000)
      });

      const data = await response.json();
      res.json({ 
        description: data.response || 'Could not describe image',
        quick: true
      });

    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to describe image',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return httpServer;
}