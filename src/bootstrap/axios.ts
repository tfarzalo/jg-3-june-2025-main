import axios from "axios";

axios.defaults.timeout = 20000;

// If VITE_API_URL is set, use it as a baseURL (do NOT break existing absolute URLs)
if (import.meta.env.VITE_API_URL && !axios.defaults.baseURL) {
  axios.defaults.baseURL = import.meta.env.VITE_API_URL;
}

axios.interceptors.response.use(
  (res) => res,
  (err) => {
    // Normalize "status code null" / network errors
    const isNetwork = !!(err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error"));
    const status = err?.response?.status ?? (isNetwork ? 0 : undefined);

    // Attach a stable, typed error shape
    err.normalized = {
      status,
      url: err?.config?.url,
      method: err?.config?.method,
      message: err?.response?.data?.message || err?.message || "Request failed",
    };

    // Prevent unhandled promise rejection message spam
    return Promise.reject(err);
  }
);

// Exporting keeps tree-shaking happy even though it's a bootstrap file
export {};
