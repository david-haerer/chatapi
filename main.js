function submitKeyOAI(event) {
  event.preventDefault();
  localStorage.setItem("keyOAI", document.getElementById("apiKeyOAI").value);
  document.getElementById("apiKeyOAI").blur();
}

function submitKeyBFL(event) {
  event.preventDefault();
  localStorage.setItem("keyBFL", document.getElementById("apiKeyBFL").value);
  document.getElementById("apiKeyBFL").blur();
}

function error(message) {
  return `<span class='error'>Error: ${message}</span>`;
}

function submitPrompt(event) {
  event.preventDefault();

  const input = document.getElementById("input").value;
  Alpine.store("chat").add("user", input);
  document.getElementById("input").value = "";
  const keyOAI = localStorage.getItem("keyOAI");
  const keyBFL = localStorage.getItem("keyBFL");

  if (input.startsWith("!img")) {
    promptDallE(key, input.slice(4));
  } else {
    promptGPT(key, input);
  }
}

async function promptDallE(key, input) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: input,
      n: 1,
      size: "1792x1024",
    }),
  });
  const json = await response.json();
  const url = json.data[0].url;
  Alpine.store("chat").add("assistant", `![${input}](${url})`);
}

async function promptGPT(key, input) {
  // Source: https://stackoverflow.com/a/75751803/11386095
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4-1106-preview",
      messages: Alpine.store("chat").messages(),
      stream: true,
    }),
  });

  if (!response.ok) {
    Alpine.store("chat").add(
      "assistant",
      error(
        `POST https://api.openai.com/v1/chat/completions ${response.status}`,
      ),
    );
    return;
  }

  const reader = response.body
    ?.pipeThrough(new TextDecoderStream())
    .getReader();

  if (!reader) {
    Alpine.store("chat").add(
      "assistant",
      error("Failed to decode API response"),
    );
    return;
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    let dataDone = false;
    const arr = value.split("\n");
    arr.forEach((data) => {
      if (data.length === 0) return;
      if (data.startsWith(":")) return;
      if (data === "data: [DONE]") {
        dataDone = true;
        return;
      }
      const token = JSON.parse(data.substring(6)).choices[0].delta.content;
      if (!token) {
        return;
      }
      hljs.highlightAll();
      Alpine.store("chat").add("assistant", token);
    });
    hljs.highlightAll();
    if (dataDone) break;
  }
}

document.getElementById("keyOAI").addEventListener("submit", submitKeyOAI);
document.getElementById("keyBFL").addEventListener("submit", submitKeyBFL);
document.getElementById("prompt").addEventListener("submit", submitPrompt);
document.getElementById("input").focus();

const keyOAI = localStorage.getItem("keyOAI");
if (keyOAI) {
  document.getElementById("apiKeyOAI").value = keyOAI;
}

const keyBFL = localStorage.getItem("keyBFL");
if (keyBFL) {
  document.getElementById("apiKeyBFL").value = keyBFL;
}

marked.setOptions({
  highlight: function (code) {
    return hljs.highlightAuto(code).value;
  },
});
