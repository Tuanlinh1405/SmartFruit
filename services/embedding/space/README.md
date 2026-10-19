---
title: SmartFruit E5
emoji: 🌱
colorFrom: green
colorTo: yellow
sdk: gradio
sdk_version: 6.30.0
python_version: 3.12.12
app_file: app.py
pinned: false
suggested_hardware: zero-a10g
---

Authenticated multilingual E5-base embedding service for SmartFruit.
Set the `EMBEDDING_SERVICE_TOKEN` Space secret (at least 32 random characters).

Model: `intfloat/multilingual-e5-base`, revision `d13f1b27baf31030b7fd040960d60d909913633f`.
768 dimensions; query/passage prefixes; L2 normalization. No Supabase DB key or user account data in this repository.

Uses ZeroGPU and is subject to its free quotas and queues. It is intended for MVP testing, without an uptime guarantee.
The shared token is validated before the GPU function. Input/output flagging and analytics are disabled.

Endpoint: `/gradio_api/call/embed`, inputs `[payload, service_token]`.
Payload: `{"texts":["Sầu riêng Ri6"],"kind":"query","modelVersion":"multilingual-e5-base-v1"}`.
Passage batches accept at most 16 texts, each at most 600 characters.
