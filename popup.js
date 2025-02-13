document.addEventListener("DOMContentLoaded", () => {
  // --- TIMER CONTROL VIA BACKGROUND ---
  const startButton = document.getElementById("start-timer-btn");
  const stopButton = document.getElementById("stop-timer-btn");
  const resetButton = document.getElementById("reset-timer-btn");
  const timerDisplay = document.getElementById("timerDisplay");
  const sessionNameDisplay = document.getElementById("sessionNameDisplay"); // Session name element

  // For continuous mode and session name
  let continuousSetting = false;
  let currentSessionName = "";

  // Utility to set the session name text in the UI, and save to storage
  function setSessionName(name) {
    currentSessionName = name;
    sessionNameDisplay.textContent = name || "";
    // Persist the session name so it remains after popup closes
    chrome.storage.sync.set({ currentSessionName: name });
  }

  // Load continuous mode and session name setting on startup
  chrome.storage.sync.get(["continuousTiming", "currentSessionName"], (data) => {
    continuousSetting = data.continuousTiming || false;
    // If there's a saved session name, restore it
    if (data.currentSessionName) {
      setSessionName(data.currentSessionName);
    }
  });

  // Query background for elapsed time every second
  function updateDisplay() {
    chrome.runtime.sendMessage({ action: "getElapsedTime" }, (response) => {
      if (response && typeof response.elapsed === "number") {
        timerDisplay.textContent = formatTime(response.elapsed);
        setCircleProgress(response.elapsed);
      } else {
        timerDisplay.textContent = "00:00:00";
        setCircleProgress(0);
      }
    });
  }

  // Format milliseconds to HH:MM:SS
  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return (
      (hours < 10 ? "0" + hours : hours) + ":" +
      (minutes < 10 ? "0" + minutes : minutes) + ":" +
      (seconds < 10 ? "0" + seconds : seconds)
    );
  }

  // Update the circular ring based on elapsed time (1 revolution per hour)
  function setCircleProgress(elapsedMs) {
    const circle = document.querySelector(".progress-ring__progress");
    if (!circle) return;

    const circumference = 565.48; // 2 * Math.PI * 90
    const totalSeconds = elapsedMs / 1000;
    const minutes = totalSeconds / 60;
    const fraction = (minutes % 60) / 60;
    const offset = circumference - fraction * circumference;
    circle.style.strokeDashoffset = offset;
  }

  // Timer commands simply send messages to the background
  function startTimer() {
    if (continuousSetting) {
      // Always prompt for a session name in continuous mode
      showModalInput("Enter session name:", currentSessionName, (name) => {
        if (name.trim()) {
          setSessionName(name.trim());
          chrome.runtime.sendMessage({ action: "startTimer", sessionName: currentSessionName }, (response) => {
            console.log("Timer started", response);
          });
        }
      });
    } else {
      // If user had previously set a session name, keep it
      chrome.runtime.sendMessage({ action: "startTimer", sessionName: currentSessionName }, (response) => {
        console.log("Timer started", response);
      });
    }
  }

  function stopTimer() {
    const previousSession = currentSessionName; // Store the current session name

    chrome.runtime.sendMessage({ action: "stopTimer", sessionName: previousSession }, (response) => {
      console.log("Timer stopped", response);
      loadSessions(); // Update the sessions list

      if (continuousSetting) {
        // In continuous mode, prompt for a new session name but do not clear the previous name if you want persistence.
        showModalInput("Enter name for next session:", currentSessionName, (name) => {
          if (name.trim()) {
            setSessionName(name.trim());
            // Reset timer first
            chrome.runtime.sendMessage({ action: "resetTimer" }, () => {
              // Then start new session immediately
              chrome.runtime.sendMessage({ action: "startTimer", sessionName: currentSessionName }, (resp) => {
                console.log("Timer restarted for continuous timing", resp);
              });
            });
          }
        });
      } else {
        // In non-continuous mode, you may choose to leave the session name as is.
        // setSessionName(""); // Remove or comment this out to keep the session name persistent.
      }
    });
  }

  function resetTimer() {
    chrome.runtime.sendMessage({ action: "resetTimer" }, (response) => {
      console.log("Timer reset", response);
    });
  }

  startButton.addEventListener("click", startTimer);
  stopButton.addEventListener("click", stopTimer);
  resetButton.addEventListener("click", resetTimer);

  // Update display every second
  setInterval(updateDisplay, 1000);

  // --- VIEW MANAGEMENT (TIMER, PLANNER, SETTINGS) ---
  const timerContainer = document.getElementById("timerContainer");
  const sessionsDiv = document.getElementById("sessions");
  const settingsDiv = document.getElementById("settings");
  const settingsBtn = document.getElementById("settingsBtn");
  const sessionsBtn = document.getElementById("sessionsBtn");
  const exportBtn = document.getElementById("export-md-btn");

  function showView(viewDiv) {
    timerContainer.style.display = "none";
    sessionsDiv.style.display = "none";
    settingsDiv.style.display = "none";
    viewDiv.style.display = "block";
    viewDiv.classList.remove("fade-in");
    void viewDiv.offsetWidth;
    viewDiv.classList.add("fade-in");
  }

  settingsBtn.addEventListener("click", () => {
    showView(settingsDiv);
    initSettings();
  });

  sessionsBtn.addEventListener("click", () => {
    showView(sessionsDiv);
    loadSessions();
  });

  exportBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "exportMarkdown" }, (response) => {
      const mdWindow = window.open("", "_blank");
      mdWindow.document.write("<pre>" + response.markdown + "</pre>");
    });
  });

  function showTimerView() {
    showView(timerContainer);
  }
  showTimerView();

  // --- SETTINGS VIEW ---
  function initSettings() {
    settingsDiv.innerHTML = `
      <h2 style="margin-top: 0;">Settings</h2>
      <div style="margin-bottom: 10px;">
        <label>
          Dark Mode:
          <input type="checkbox" id="enableDarkMode" />
        </label>
      </div>
      <div style="margin-bottom: 10px;">
        <label>
          Continuous Timing:
          <input type="checkbox" id="continuousTiming" />
        </label>
      </div>
      <div style="margin-top: 10px; text-align: center;">
        <button id="saveSettingsBtn" style="margin-right: 10px;">Save Settings</button>
        <button id="backFromSettingsBtn">Back</button>
      </div>
    `;
    const saveBtn = document.getElementById("saveSettingsBtn");
    const backBtn = document.getElementById("backFromSettingsBtn");
    const darkModeCheckbox = document.getElementById("enableDarkMode");
    const continuousCheckbox = document.getElementById("continuousTiming");
    chrome.storage.sync.get(["enableDarkMode", "continuousTiming"], (data) => {
      darkModeCheckbox.checked = data.enableDarkMode || false;
      continuousCheckbox.checked = data.continuousTiming || false;
      updateDarkMode(data.enableDarkMode);
      continuousSetting = data.continuousTiming || false;
    });
    saveBtn.addEventListener("click", () => {
      const newDark = darkModeCheckbox.checked;
      const newContinuous = continuousCheckbox.checked;
      chrome.storage.sync.set({ enableDarkMode: newDark, continuousTiming: newContinuous }, () => {
        console.log("Settings saved.");
        showInlineNotification("Settings saved!");
        updateDarkMode(newDark);
        continuousSetting = newContinuous;
        showTimerView();
      });
    });
    backBtn.addEventListener("click", showTimerView);
  }

  function showInlineNotification(message) {
    let notif = document.getElementById("notification");
    if (!notif) {
      notif = document.createElement("div");
      notif.id = "notification";
      document.body.appendChild(notif);
    }
    notif.textContent = message;
    notif.style.opacity = "1";
    setTimeout(() => {
      notif.style.opacity = "0";
    }, 3000);
  }

  // --- PLANNER VIEW (DRAG & DROP, IMPORT) ---
  function loadSessions() {
    chrome.runtime.sendMessage({ action: "getSessions" }, (response) => {
      sessionsDiv.innerHTML = "";
      if (!response.sessions) {
        console.error("No sessions found in response");
        return;
      }
      const header = document.createElement("div");
      header.className = "sessions-header";
      header.textContent = "Planner";
      sessionsDiv.appendChild(header);

      const toolbar = document.createElement("div");
      toolbar.className = "sessions-toolbar";
      const backBtn = document.createElement("button");
      backBtn.textContent = "Back";
      backBtn.addEventListener("click", showTimerView);
      toolbar.appendChild(backBtn);

      const addBtn = document.createElement("button");
      addBtn.textContent = "Add Session";
      addBtn.addEventListener("click", () => {
        showModalInput("Enter session name:", "", (name) => {
          if (name) {
            chrome.runtime.sendMessage({ action: "addSession", sessionName: name, elapsed: 0 }, () => {
              loadSessions();
            });
          }
        });
      });
      toolbar.appendChild(addBtn);

      const importBtn = document.createElement("button");
      importBtn.textContent = "Import Planner";
      importBtn.addEventListener("click", () => {
        showModalTextarea("Paste planner markdown:", "", (imported) => {
          if (imported) {
            const lines = imported.split("\n").filter(line => line.trim() !== "");
            const sessions = [];
            lines.forEach(line => {
              // Expect format: "1. Session Name — HH:MM:SS"
              const parts = line.split("—");
              if (parts.length >= 2) {
                let namePart = parts[0].split(".")[1];
                if (namePart) {
                  namePart = namePart.trim();
                } else {
                  // Fallback: remove the numbering manually
                  const dotIndex = parts[0].indexOf('.');
                  namePart = parts[0].substring(dotIndex + 1).trim();
                }
                const timeStr = parts[1].trim();
                const elapsed = parseTimeString(timeStr);
                sessions.push({ name: namePart, elapsed: elapsed });
              }
            });
            chrome.storage.sync.set({ sessions: sessions }, () => {
              showInlineNotification("Planner imported.");
              loadSessions();
            });
          }
        });
      });
      toolbar.appendChild(importBtn);

      sessionsDiv.appendChild(toolbar);

      response.sessions.forEach((session, index) => {
        const sessionCard = document.createElement("div");
        sessionCard.className = "session";
        sessionCard.draggable = true;
        sessionCard.dataset.index = index;

        // Drag events for reordering
        sessionCard.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", index);
        });
        sessionCard.addEventListener("dragover", (e) => {
          e.preventDefault();
        });
        sessionCard.addEventListener("drop", (e) => {
          e.preventDefault();
          const draggedIndex = parseInt(e.dataTransfer.getData("text/plain"));
          const dropIndex = parseInt(sessionCard.dataset.index);
          if (draggedIndex === dropIndex) return;
          chrome.runtime.sendMessage({ action: "getSessions" }, (resp) => {
            let sessions = resp.sessions;
            const draggedSession = sessions.splice(draggedIndex, 1)[0];
            sessions.splice(dropIndex, 0, draggedSession);
            chrome.runtime.sendMessage({ action: "reorderSessions", sessions: sessions }, (res) => {
              console.log("Sessions reordered", res);
              loadSessions();
            });
          });
        });

        const infoDiv = document.createElement("div");
        infoDiv.className = "session-info";
        infoDiv.textContent = `${index + 1}. ${session.name || "Unnamed"} — ${formatTime(session.elapsed)}`;
        sessionCard.appendChild(infoDiv);

        // Options toggle button
        const optionsToggle = document.createElement("button");
        optionsToggle.className = "options-toggle";
        optionsToggle.textContent = "⋮";
        sessionCard.appendChild(optionsToggle);

        // Hidden options menu
        const optionsMenu = document.createElement("div");
        optionsMenu.className = "options-menu";

        // Delete button
        const delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.title = "Delete Session";
        delBtn.addEventListener("click", () => {
          chrome.runtime.sendMessage({ action: "deleteSession", index: index }, () => {
            loadSessions();
          });
        });
        optionsMenu.appendChild(delBtn);

        // Edit button
        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.title = "Edit Session";
        editBtn.addEventListener("click", () => {
          showModalInputTwo(
            "Enter new session name:",
            session.name,
            "Enter new session time (HH:MM:SS):",
            formatTime(session.elapsed),
            (newName, newTimeStr) => {
              const newElapsed = parseTimeString(newTimeStr);
              chrome.runtime.sendMessage({
                action: "editSession",
                index: index,
                newName: newName || session.name,
                newElapsed: newElapsed
              }, () => {
                loadSessions();
              });
            }
          );
        });
        optionsMenu.appendChild(editBtn);

        sessionCard.appendChild(optionsMenu);

        optionsToggle.addEventListener("click", () => {
          optionsMenu.classList.toggle("show");
        });

        sessionsDiv.appendChild(sessionCard);
      });
    });
  }

  function parseTimeString(timeStr) {
    const parts = timeStr.split(":");
    if (parts.length !== 3) return 0;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return ((hours * 3600) + (minutes * 60) + seconds) * 1000;
  }

  // Modal helpers
  function showModalInput(message, defaultValue, callback) {
    let overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    let container = document.createElement("div");
    container.className = "modal-container";
    let p = document.createElement("p");
    p.textContent = message;
    let input = document.createElement("input");
    input.type = "text";
    input.value = defaultValue || "";
    input.style.width = "100%";
    input.style.marginTop = "10px";
    let submitButton = document.createElement("button");
    submitButton.textContent = "Submit";
    submitButton.style.marginTop = "10px";
    submitButton.addEventListener("click", () => {
      callback(input.value);
      document.body.removeChild(overlay);
    });
    container.appendChild(p);
    container.appendChild(input);
    container.appendChild(submitButton);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
  }

  function showModalInputTwo(msg1, default1, msg2, default2, callback) {
    let overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    let container = document.createElement("div");
    container.className = "modal-container";
    let p1 = document.createElement("p");
    p1.textContent = msg1;
    let input1 = document.createElement("input");
    input1.type = "text";
    input1.value = default1 || "";
    input1.style.width = "100%";
    input1.style.marginTop = "10px";
    let p2 = document.createElement("p");
    p2.textContent = msg2;
    p2.style.marginTop = "10px";
    let input2 = document.createElement("input");
    input2.type = "text";
    input2.value = default2 || "";
    input2.style.width = "100%";
    input2.style.marginTop = "10px";
    let submitButton = document.createElement("button");
    submitButton.textContent = "Submit";
    submitButton.style.marginTop = "10px";
    submitButton.addEventListener("click", () => {
      callback(input1.value, input2.value);
      document.body.removeChild(overlay);
    });
    container.appendChild(p1);
    container.appendChild(input1);
    container.appendChild(p2);
    container.appendChild(input2);
    container.appendChild(submitButton);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
  }

  function showModalTextarea(message, defaultValue, callback) {
    let overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    let container = document.createElement("div");
    container.className = "modal-container";
    let p = document.createElement("p");
    p.textContent = message;
    let textarea = document.createElement("textarea");
    textarea.value = defaultValue || "";
    textarea.style.width = "100%";
    textarea.style.height = "150px";
    textarea.style.marginTop = "10px";
    let submitButton = document.createElement("button");
    submitButton.textContent = "Submit";
    submitButton.style.marginTop = "10px";
    submitButton.addEventListener("click", () => {
      callback(textarea.value);
      document.body.removeChild(overlay);
    });
    container.appendChild(p);
    container.appendChild(textarea);
    container.appendChild(submitButton);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
  }

  // Function to handle dark mode toggle
  function updateDarkMode(enabled) {
    if (enabled) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }

  // Initialize dark mode on load
  chrome.storage.sync.get(["enableDarkMode"], (data) => {
    updateDarkMode(data.enableDarkMode || false);
  });
});
