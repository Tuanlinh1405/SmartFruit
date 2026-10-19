import spaces  # Must precede torch/sentence-transformers for ZeroGPU initialization.
import os
import gradio as gr

from gradio_contract import validate_request
from model import Encoder, MODEL_VERSION

os.environ['EMBEDDING_DEVICE'] = 'cuda'
encoder = Encoder()  # Place model on CUDA at module level, as required by ZeroGPU.


@spaces.GPU(duration=10)
def encode_gpu(texts, kind):
    return encoder.encode(texts, kind)


def embed(payload, api_key):
    texts, kind = validate_request(payload, api_key, os.environ.get('EMBEDDING_SERVICE_TOKEN'))
    return {'modelVersion': MODEL_VERSION, 'vectors': encode_gpu(texts, kind)}


demo = gr.Interface(
    fn=embed,
    inputs=[gr.JSON(label='Embedding request'), gr.Textbox(label='Service token', type='password')],
    outputs=gr.JSON(label='Embedding response'),
    title='SmartFruit E5 · private backend access',
    description='Authenticated embedding endpoint. No database credentials are stored in this Space.',
    flagging_mode='never',
    analytics_enabled=False,
    api_name='embed',
)

if __name__ == '__main__':
    demo.queue(max_size=8, default_concurrency_limit=1).launch(
        server_name='0.0.0.0', server_port=7860, show_error=False,
    )
