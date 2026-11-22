import type { PlatformAdapter } from "../types";
import { kiwify } from "./kiwify";
import { hotmart } from "./hotmart";

// Plataforma nova = escrever um adaptador e registrar aqui.
export const adapters: Record<string, PlatformAdapter> = {
  [kiwify.id]: kiwify,
  [hotmart.id]: hotmart,
};
