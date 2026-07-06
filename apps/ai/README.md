# CloudCommerce AI Service

Microservicio FastAPI que provee toda la inteligencia del sistema. Lo consume `apps/api`
vía HTTP interno (`/internal/ai/v1/*`) con token compartido — nunca se expone a internet.

## Capacidades

| Área | Endpoint | Modelo |
|------|----------|--------|
| Descripciones de producto | `POST /internal/ai/v1/products/generate-description` | OpenAI (texto) |
| Especificaciones estructuradas | `POST /internal/ai/v1/products/generate-specs` | OpenAI (texto) |
| SEO (título/meta/keywords) | `POST /internal/ai/v1/products/generate-seo` | OpenAI (texto) |
| Análisis experto de foto | `POST /internal/ai/v1/images/analyze` | OpenAI (visión) |
| Mejora de imagen a calidad de catálogo | `POST /internal/ai/v1/images/enhance` | GPT visión + Gemini imagen |
| Generación de imagen desde cero | `POST /internal/ai/v1/images/generate` | Gemini imagen |
| Perfil de intereses del cliente | `POST /internal/ai/v1/customers/analyze-profile` | OpenAI (texto) |
| Mensaje de venta proactivo (WhatsApp) | `POST /internal/ai/v1/customers/outreach` | OpenAI (texto) |
| Respuesta del vendedor IA | `POST /internal/ai/v1/customers/reply` | OpenAI (texto) |
| Recomendaciones de catálogo | `POST /internal/ai/v1/recommendations` | OpenAI (texto) |
| Señales de tendencia | `POST /internal/ai/v1/trends/analyze` | OpenAI (texto) |
| Pricing con margen seguro | `POST /internal/ai/v1/pricing/optimize` | Determinístico (sin LLM) |

El pipeline de imágenes es de dos etapas: GPT (visión) critica la foto como director de arte
y produce un plan de retoque; Gemini edita/regenera la imagen siguiendo ese plan y una
plantilla de fotografía comercial (studio / lifestyle / hero / minimal), preservando la
identidad exacta del producto.

## Seguridad

- Auth: `Authorization: Bearer $AI_SERVICE_TOKEN` en todas las rutas (mismo valor que en apps/api).
- Todo dato de catálogo/cliente viaja marcado como no-confiable (`<untrusted-*>`): el modelo
  tiene instrucciones explícitas de no obedecer instrucciones embebidas (anti prompt-injection),
  incluyendo mensajes escritos por clientes en WhatsApp.
- El vendedor IA tiene límites duros: no inventa precios/stock/descuentos, solo recomienda
  productIds presentes en la lista de candidatos, y puede decidir **no** enviar (`shouldSend=false`).

## Correr en local

```bash
cd apps/ai
python -m pip install -r requirements.txt
cp .env.example .env   # completar OPENAI_API_KEY, GEMINI_API_KEY, AI_SERVICE_TOKEN
python -m uvicorn src.main:app --reload --port 8000
```

Tests: `python -m pytest`.

Docker: `docker build -t cloudcommerce-ai . && docker run --env-file .env -p 8000:8000 cloudcommerce-ai`.
