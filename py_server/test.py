import torch
print(torch.__version__)
print(torch.cuda.is_available())  # Should be True
print(torch.cuda.get_device_name(0))  # "NVIDIA GeForce GTX 1660"
print(torch.cuda.device_count())  # 1