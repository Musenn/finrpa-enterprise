import { create } from "zustand";

const LLM_STORAGE_KEYS = {
  apiKey: "finrpa_llm_api_key",
  baseUrl: "finrpa_llm_base_url",
  modelName: "finrpa_llm_model_name",
  forceStream: "finrpa_llm_force_stream",
} as const;

type LLMConfigState = {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  forceStream: boolean;
  setConfig: (config: {
    apiKey: string;
    baseUrl: string;
    modelName: string;
    forceStream: boolean;
  }) => void;
  loadConfig: () => void;
};

const useLLMConfigStore = create<LLMConfigState>((set) => ({
  apiKey: "",
  baseUrl: "",
  modelName: "",
  forceStream: false,
  setConfig: (config) => {
    localStorage.setItem(LLM_STORAGE_KEYS.apiKey, config.apiKey);
    localStorage.setItem(LLM_STORAGE_KEYS.baseUrl, config.baseUrl);
    localStorage.setItem(LLM_STORAGE_KEYS.modelName, config.modelName);
    localStorage.setItem(
      LLM_STORAGE_KEYS.forceStream,
      String(config.forceStream),
    );
    set(config);
  },
  loadConfig: () => {
    const apiKey = localStorage.getItem(LLM_STORAGE_KEYS.apiKey) ?? "";
    const baseUrl = localStorage.getItem(LLM_STORAGE_KEYS.baseUrl) ?? "";
    const modelName = localStorage.getItem(LLM_STORAGE_KEYS.modelName) ?? "";
    const forceStream =
      localStorage.getItem(LLM_STORAGE_KEYS.forceStream) === "true";
    set({ apiKey, baseUrl, modelName, forceStream });
  },
}));

export { useLLMConfigStore };
