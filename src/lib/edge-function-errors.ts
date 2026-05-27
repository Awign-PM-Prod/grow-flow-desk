export const parseEdgeFunctionError = async (
  error: unknown,
  data: unknown,
): Promise<string> => {
  const fromData =
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
      ? (data as { error: string }).error
      : undefined;

  if (fromData) {
    return fromData;
  }

  const errWithContext = error as {
    message?: string;
    context?: { body?: string; json?: () => Promise<unknown>; text?: () => Promise<string> };
  };

  const context = errWithContext.context;

  if (context?.body) {
    try {
      const parsed = JSON.parse(context.body) as { error?: string };
      if (typeof parsed.error === "string") {
        return parsed.error;
      }
    } catch {
      // ignore parse issues
    }
  }

  if (typeof context?.json === "function") {
    try {
      const parsed = (await context.json()) as { error?: string; message?: string };
      if (typeof parsed.error === "string") {
        return parsed.error;
      }
      if (typeof parsed.message === "string") {
        return parsed.message;
      }
    } catch {
      // ignore
    }
  }

  if (typeof context?.text === "function") {
    try {
      const text = await context.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: string; message?: string };
          if (typeof parsed.error === "string") {
            return parsed.error;
          }
          if (typeof parsed.message === "string") {
            return parsed.message;
          }
        } catch {
          return text;
        }
      }
    } catch {
      // ignore
    }
  }

  return errWithContext.message || "Request failed";
};
