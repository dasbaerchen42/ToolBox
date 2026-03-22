import { parseDocument } from "yaml";
import { WritingMode } from "@/lib/storage";

export type ValidationResult = {
  status: "idle" | "success" | "warning" | "error";
  title: string;
  messages: string[];
};

function countChar(text: string, char: string) {
  return text.split(char).length - 1;
}

function hasBalancedPairs(text: string, openChar: string, closeChar: string) {
  let count = 0;

  for (const ch of text) {
    if (ch === openChar) count += 1;
    if (ch === closeChar) count -= 1;
    if (count < 0) return false;
  }

  return count === 0;
}

function validateJson(content: string): ValidationResult {
  if (!content.trim()) {
    return {
      status: "idle",
      title: "JSON 檢查",
      messages: ["目前沒有內容可檢查。"],
    };
  }

  try {
    JSON.parse(content);
    return {
      status: "success",
      title: "JSON 檢查",
      messages: ["JSON 格式正確。"],
    };
  } catch (error) {
    return {
      status: "error",
      title: "JSON 檢查",
      messages: [error instanceof Error ? error.message : "JSON 格式錯誤。"],
    };
  }
}

function validateYaml(content: string): ValidationResult {
  if (!content.trim()) {
    return {
      status: "idle",
      title: "YAML 檢查",
      messages: ["目前沒有內容可檢查。"],
    };
  }

  const doc = parseDocument(content);

  if (doc.errors.length > 0) {
    return {
      status: "error",
      title: "YAML 檢查",
      messages: doc.errors.map((err) => err.message),
    };
  }

  const warnings: string[] = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    if (/^\t+/.test(line)) {
      warnings.push(`第 ${index + 1} 行使用了 tab，YAML 建議用空白縮排。`);
    }

    if (/:\S/.test(line)) {
      warnings.push(`第 ${index + 1} 行冒號後面建議保留一個空格。`);
    }
  });

  if (warnings.length > 0) {
    return {
      status: "warning",
      title: "YAML 檢查",
      messages: warnings,
    };
  }

  return {
    status: "success",
    title: "YAML 檢查",
    messages: ["YAML 格式看起來正常。"],
  };
}

function validateMarkdown(content: string): ValidationResult {
  if (!content.trim()) {
    return {
      status: "idle",
      title: "Markdown 提示",
      messages: ["目前沒有內容可檢查。"],
    };
  }

  const warnings: string[] = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    if (/^#{1,6}\S/.test(line)) {
      warnings.push(`第 ${index + 1} 行標題 # 後面建議加空格。`);
    }

    if (/^\s*[-*+]\S/.test(line)) {
      warnings.push(`第 ${index + 1} 行清單符號後面建議加空格。`);
    }

    if (/^\d+\.\S/.test(line)) {
      warnings.push(`第 ${index + 1} 行有序清單數字後面建議加空格。`);
    }
  });

  if (warnings.length > 0) {
    return {
      status: "warning",
      title: "Markdown 提示",
      messages: warnings,
    };
  }

  return {
    status: "success",
    title: "Markdown 提示",
    messages: ["Markdown 結構看起來正常。"],
  };
}

function validateHtml(content: string): ValidationResult {
  if (!content.trim()) {
    return {
      status: "idle",
      title: "HTML 提示",
      messages: ["目前沒有內容可檢查。"],
    };
  }

  const messages: string[] = [];

  if (!hasBalancedPairs(content, "<", ">")) {
    messages.push("看起來有未配對的 < 或 >。");
  }

  if (!hasBalancedPairs(content, "(", ")")) {
    messages.push("看起來有未配對的括號 ()。");
  }

  if (!hasBalancedPairs(content, "{", "}")) {
    messages.push("看起來有未配對的大括號 {}。");
  }

  const openDivs = countChar(content, "<div");
  const closeDivs = countChar(content, "</div>");
  if (openDivs !== closeDivs) {
    messages.push(`div 標籤數量可能不一致：開啟 ${openDivs} / 關閉 ${closeDivs}。`);
  }

  return messages.length > 0
    ? {
        status: "warning",
        title: "HTML 提示",
        messages,
      }
    : {
        status: "success",
        title: "HTML 提示",
        messages: ["HTML 基本結構看起來正常。"],
      };
}

function validateCss(content: string): ValidationResult {
  if (!content.trim()) {
    return {
      status: "idle",
      title: "CSS 提示",
      messages: ["目前沒有內容可檢查。"],
    };
  }

  const messages: string[] = [];

  if (!hasBalancedPairs(content, "{", "}")) {
    messages.push("看起來有未配對的大括號 {}。");
  }

  if (!hasBalancedPairs(content, "(", ")")) {
    messages.push("看起來有未配對的括號 ()。");
  }

  const lines = content.split("\n");
  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (
      trimmed &&
      !trimmed.endsWith("{") &&
      !trimmed.endsWith("}") &&
      !trimmed.endsWith(";") &&
      !trimmed.startsWith("@")
    ) {
      messages.push(`第 ${index + 1} 行可能少了分號或大括號。`);
    }
  });

  return messages.length > 0
    ? {
        status: "warning",
        title: "CSS 提示",
        messages,
      }
    : {
        status: "success",
        title: "CSS 提示",
        messages: ["CSS 基本結構看起來正常。"],
      };
}

function validateSocial(content: string): ValidationResult {
  if (!content.trim()) {
    return {
      status: "idle",
      title: "Social 模式",
      messages: ["目前沒有內容可排版。"],
    };
  }

  const messages: string[] = ["可使用下方按鈕快速整理社群貼文格式。"];

  if (content.length > 2200) {
    messages.push("內容偏長，某些社群平台可能會折疊或截斷。");
  }

  return {
    status: "warning",
    title: "Social 模式",
    messages,
  };
}

export function validateContent(
  mode: WritingMode,
  content: string
): ValidationResult {
  switch (mode) {
    case "json":
      return validateJson(content);
    case "yaml":
      return validateYaml(content);
    case "markdown":
      return validateMarkdown(content);
    case "html":
      return validateHtml(content);
    case "css":
      return validateCss(content);
    case "social":
      return validateSocial(content);
    default:
      return {
        status: "idle",
        title: "一般模式",
        messages: ["目前模式不需要額外檢查。"],
      };
  }
}