export type QuestionCapture = {
  question: string;
  output: string;
  foundButton: boolean;
  examples: number;
};

export type CodeCapture = {
  code: string;
  found: boolean;
};

export function grabQuestionInPage(): QuestionCapture {
  const button = document.getElementById("bookmarkButton");
  let question = "";
  if (button) {
    const heading = button.closest("h2") || button.parentElement;
    if (heading) {
      const clone = heading.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("#bookmarkButton").forEach((node) => node.remove());
      question = clone.textContent?.replace(/\s+/g, " ").trim() ?? "";
    }
  }

  const examples = [...document.querySelectorAll(".example")];
  return {
    question,
    output: examples.map((element) => (element as HTMLElement).innerText.trim()).filter(Boolean).join("\n\n"),
    foundButton: Boolean(button),
    examples: examples.length
  };
}

export function grabCodeInPage(): CodeCapture {
  const editor = document.querySelector("#codeEditor .cm-content") || document.querySelector(".cm-content");
  if (!editor) {
    return { code: "", found: false };
  }

  return {
    code: [...editor.querySelectorAll(".cm-line")].map((line) => line.textContent ?? "").join("\n"),
    found: true
  };
}
