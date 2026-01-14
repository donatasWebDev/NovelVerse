# Keep your proven base with CUDA 11.8 + PyTorch 2.1
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# ──────────────────────────────────────────────────────────────────────────────
# Minimal system deps: only what TTS + audio encoding + git really needs

RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel

# ──────────────────────────────────────────────────────────────────────────────
RUN apt-get update --yes --quiet && \
    DEBIAN_FRONTEND=noninteractive apt-get install --yes --quiet --no-install-recommends \
        ffmpeg \
        libmp3lame0 \
        libsndfile1 \
        git \
    && \
    # Super aggressive cleanup
    apt-get clean && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /usr/share/man/* /usr/share/doc/*

# ──────────────────────────────────────────────────────────────────────────────
# GPU + Python env vars (helps stability & memory management)
# ──────────────────────────────────────────────────────────────────────────────
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    PYTHONUNBUFFERED=1 \
    PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512 \
    TORCH_USE_CUDA_DSA=1

# ──────────────────────────────────────────────────────────────────────────────
# Working dir + deps
# ──────────────────────────────────────────────────────────────────────────────
WORKDIR /app

# Copy & install Python requirements first (best caching)
COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.1.0+cu118 torchvision==0.16.0+cu118 torchaudio==2.1.0 --index-url https://download.pytorch.org/whl/cu118

RUN pip install --no-cache-dir --ignore-installed blinker>=1.7.0

RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir runpod

# Your reqs
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Clean pip cache
RUN pip cache purge
# Code
COPY . /app/

EXPOSE 12345
CMD ["python", "handler.py"]