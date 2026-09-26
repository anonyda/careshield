-- Store idempotent responses as json (text-preserving) so replays are byte-identical.
ALTER TABLE "idempotency_keys" ALTER COLUMN "response_body" SET DATA TYPE JSON USING "response_body"::json;
