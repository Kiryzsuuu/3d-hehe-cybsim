FROM alpine:3.20

RUN adduser -D -H sandboxuser
USER sandboxuser
WORKDIR /home/sandboxuser

# This image intentionally ships no shell utilities beyond busybox defaults.
# CPU/memory limits are NOT set here — they must be applied at container-create
# time via dockerode (SANDBOX_CPU_LIMIT / SANDBOX_MEMORY_LIMIT), and the
# container must be created with NetworkMode disabled/none so it cannot reach
# the host network. See apps/api/src/services/sandbox.

CMD ["sleep", "infinity"]
