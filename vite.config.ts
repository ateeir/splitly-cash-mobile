import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-handler',
    configureServer(server) {
      server.middlewares.use('/api/scan-receipt', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { base64Data, mimeType, apiKey } = JSON.parse(body);
            console.log('[DEV-API] Request received, apiKey present:', !!apiKey, '| base64 length:', base64Data?.length ?? 0);

            if (!apiKey) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing Gemini API key.' }));
              return;
            }
            if (!base64Data) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing image data.' }));
              return;
            }

            const { GoogleGenAI, Type } = await import('@google/genai');
            console.log('[DEV-API] Calling Gemini API (model: gemini-2.5-flash)...');
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [{
                parts: [
                  { inlineData: { data: base64Data, mimeType: mimeType || 'image/jpeg' } },
                  {
                    text: "Extract all individual line items from this receipt. For each item, provide the name and the final price. Also extract the subtotal and the total tax amount. If an item has a quantity greater than 1, please list it as a single entry with the total price for that line. Return the data in JSON format."
                  }
                ]
              }],
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          price: { type: Type.NUMBER }
                        },
                        required: ["name", "price"]
                      }
                    },
                    tax: { type: Type.NUMBER },
                    subtotal: { type: Type.NUMBER }
                  },
                  required: ["items", "tax", "subtotal"]
                }
              }
            });

            const text = response.text;
            console.log('[DEV-API] Response text:', text);
            if (!text || text.trim() === '') {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'No response from Gemini AI.' }));
              return;
            }

            let data;
            try {
              data = JSON.parse(text);
            } catch {
              console.error('[DEV-API] JSON parse failed. Raw:', text);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Gemini returned invalid data. Try a clearer photo.' }));
              return;
            }

            console.log('[DEV-API] Parsed items:', data.items?.length ?? 0);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          } catch (error: any) {
            console.error('[DEV-API] Error:', error);
            const isInvalidKey = error?.status === 401 || error?.status === 400 || error?.message?.includes('API key');
            res.statusCode = isInvalidKey ? 401 : 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: isInvalidKey
                ? 'Invalid Gemini API key. Please check your key and try again.'
                : error?.status === 429
                  ? 'Rate limit exceeded. Wait a moment and try again.'
                  : 'Failed to process receipt. Please try again.'
            }));
          }
        });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss(), apiDevPlugin()],
      define: {
        'process.env': '{}'
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
