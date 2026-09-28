# Floret Protocol

Version: v1 (draft)

<!-- Written in CP7. Start from Appendix A of the build guide. -->

---

## 1. Overview

<!-- What a floret is, and what this spec covers. -->

---

## 2. Transport

<!-- Which streams carry what, how messages are framed, and where logs go. -->

---

## 3. Versioning

<!-- How a floret learns the protocol version, and what happens on a mismatch. -->

---

## 4. Events: Diaspore to floret

### 4.1 init

| Field | Type | Required | Meaning |
|---|---|---|---|

### 4.2 message

| Field | Type | Required | Meaning |
|---|---|---|---|

### 4.3 timer

| Field | Type | Required | Meaning |
|---|---|---|---|

---

## 5. Reply: floret to Diaspore

### 5.1 done

| Field | Type | Required | Meaning |
|---|---|---|---|

---

## 6. Rules every floret must follow

<!-- The determinism contract, one rule per line. -->

---

## 7. Crash and restart

<!-- What a crash does, and what a restarted floret receives. -->

---

## 8. Errors

<!-- Invalid JSON, unknown event types, missing fields, early exit, and hangs. -->

---

## 9. JSON Schema files

| File | Describes |
|---|---|

---

## 10. Determinism traps by language

### Go

### Python

### JavaScript

### Other languages

---

## 11. Examples

<!-- One full exchange, line by line. -->

---

## 12. Changelog

| Version | Date | Change |
|---|---|---|
