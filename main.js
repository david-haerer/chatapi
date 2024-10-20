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

  const prompt = document.getElementById("prompt").value;
  Alpine.store("chat").add("user", prompt);
  document.getElementById("prompt").value = "";
  const keyOAI = localStorage.getItem("keyOAI");
  const keyBFL = localStorage.getItem("keyBFL");

  if (prompt.startsWith("!img")) {
    promptImage(keyBFL, prompt.slice(4));
  } else {
    promptText(keyOAI);
  }
}

async function promptImage(key, prompt) {
  const response = await fetch("https://api.bfl.ml/v1/flux-pro-1.1", {
    method: "POST",
    headers: {
      accept: "application/json",
      "x-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: prompt,
      width: 1024,
      height: 768,
    }),
  });
  const json = await response.json();
  const id = json["id"];
  const polling = setInterval(async () => {
    const response = await fetch(`https://api.bfl.ml/v1/get_result?id=${id}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-key": key,
      },
    });
    const json = await response.json();
    if (
      json["status"] == "Request Moderated" ||
      json["status"] == "Content Moderated"
    ) {
      clearInterval(polling);
      Alpine.store("chat").add(
        "assistant",
        error("Request denied by Black Forest Labs."),
      );
    }
    if (json["status"] === "Ready") {
      clearInterval(polling);
      const url = json["result"]["sample"];
      Alpine.store("chat").add("assistant", `![${prompt}](${url})`);
    }
  }, 1000);
}

async function promptText(key) {
  // Source: https://stackoverflow.com/a/75751803/11386095
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
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
document.getElementById("submit").addEventListener("submit", submitPrompt);
document.getElementById("prompt").focus();

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
