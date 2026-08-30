-- CP-02: Deduplicacao por Request-ID
-- Adiciona as_request_id em call_pro_calls para idempotencia de webhooks.
-- O Atende Simples envia X-AtendeSimples-Request-Id por requisicao; retransmissoes
-- terao o mesmo request_id e devem ser ignoradas.
--
-- Nullable: chamadas criadas via dialer (outbound) nao possuem este campo.
-- UNIQUE parcial (WHERE IS NOT NULL): NULLs multiplos sao permitidos.

ALTER TABLE call_pro_calls
  ADD COLUMN IF NOT EXISTS as_request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_pro_calls_request_id
  ON call_pro_calls(as_request_id)
  WHERE as_request_id IS NOT NULL;
