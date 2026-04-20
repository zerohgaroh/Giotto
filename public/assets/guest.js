(function () {
  const WAIT_SEC = 120;
  const RING_RADIUS = 50;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  function readJsonScript(id) {
    const node = document.getElementById(id);
    if (!node) return {};

    try {
      return JSON.parse(node.textContent || "{}");
    } catch {
      return {};
    }
  }

  function normalizeTableId(raw) {
    let decoded = "";

    try {
      decoded = decodeURIComponent(String(raw || ""));
    } catch {
      decoded = String(raw || "");
    }

    const parsed = Number(decoded.trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.floor(parsed);
  }

  function formatPrice(sum) {
    return `${new Intl.NumberFormat("ru-RU").format(Number(sum || 0))} so'm`;
  }

  function getSessionStorage() {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }

  function storageKey(tableId) {
    return `giotto:guest-cart:${String(tableId || "").trim()}`;
  }

  function normalizeCartLines(lines) {
    if (!Array.isArray(lines)) {
      return [];
    }

    const merged = new Map();
    for (const line of lines) {
      if (!line || typeof line !== "object") continue;
      const dishId = typeof line.dishId === "string" ? line.dishId.trim() : "";
      const qty = Math.floor(Number(line.qty || 0));
      if (!dishId || qty <= 0) continue;
      merged.set(dishId, (merged.get(dishId) || 0) + qty);
    }

    return Array.from(merged.entries()).map(([dishId, qty]) => ({ dishId, qty }));
  }

  function readCart(tableId) {
    const storage = getSessionStorage();
    if (!storage) {
      return [];
    }

    try {
      const raw = storage.getItem(storageKey(tableId));
      if (!raw) return [];
      return normalizeCartLines(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  function writeCart(tableId, lines) {
    const storage = getSessionStorage();
    if (!storage) {
      return normalizeCartLines(lines);
    }

    const normalized = normalizeCartLines(lines);
    try {
      storage.setItem(storageKey(tableId), JSON.stringify(normalized));
    } catch {
      // ignore storage failures
    }
    return normalized;
  }

  function clearCart(tableId) {
    const storage = getSessionStorage();
    if (!storage) {
      return;
    }

    try {
      storage.removeItem(storageKey(tableId));
    } catch {
      // ignore storage failures
    }
  }

  function buildDishMap(dishes) {
    const map = new Map();
    for (const dish of Array.isArray(dishes) ? dishes : []) {
      if (dish && typeof dish.id === "string") {
        map.set(dish.id, dish);
      }
    }
    return map;
  }

  function safeClipboardCopy(value) {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      return Promise.reject(new Error("Clipboard API is not available"));
    }

    return navigator.clipboard.writeText(value);
  }

  function optimizeMenuImageUrl(url, width) {
    if (typeof url !== "string" || !url) {
      return url;
    }

    try {
      const parsed = new URL(url, window.location.origin);
      if (!parsed.pathname.includes("/api/uploads/menu/")) {
        return url;
      }
      parsed.searchParams.set("w", String(width));
      return parsed.toString();
    } catch {
      return url;
    }
  }

  function reviewPrompt(configId) {
    const config = readJsonScript(configId);

    return {
      tableId: config.tableId || "",
      numericTableId: normalizeTableId(config.tableId),
      reviewUrl: config.reviewUrl || "",
      sseUrl: config.sseUrl || "/api/realtime/stream",
      open: false,
      rating: 5,
      comment: "",
      submitting: false,
      expiresAt: 0,
      eventSource: null,
      expiryTimer: null,

      init() {
        if (!this.numericTableId || !this.sseUrl || typeof EventSource === "undefined") {
          return;
        }

        this.eventSource = new EventSource(this.sseUrl);
        this.eventSource.addEventListener("waiter:done", (event) => {
          let payload;
          try {
            payload = JSON.parse(event.data);
          } catch {
            return;
          }

          if (payload.tableId !== this.numericTableId) {
            return;
          }

          const expiresAt = Number(payload.payload && payload.payload.expiresAt);
          this.expiresAt = Number.isFinite(expiresAt) ? expiresAt : Date.now() + 60_000;
          this.rating = 5;
          this.comment = "";
          this.open = true;
          this.syncExpiryTimer();
        });

        this.eventSource.addEventListener("review:submitted", (event) => {
          let payload;
          try {
            payload = JSON.parse(event.data);
          } catch {
            return;
          }

          if (payload.tableId !== this.numericTableId) {
            return;
          }

          this.closePrompt();
        });
      },

      destroy() {
        if (this.expiryTimer) {
          window.clearTimeout(this.expiryTimer);
          this.expiryTimer = null;
        }

        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
      },

      syncExpiryTimer() {
        if (this.expiryTimer) {
          window.clearTimeout(this.expiryTimer);
          this.expiryTimer = null;
        }

        if (!this.open || this.expiresAt <= 0) {
          return;
        }

        const delay = this.expiresAt - Date.now();
        if (delay <= 0) {
          this.closePrompt();
          return;
        }

        this.expiryTimer = window.setTimeout(() => {
          this.closePrompt();
        }, delay);
      },

      closePrompt() {
        this.open = false;
        this.expiresAt = 0;

        if (this.expiryTimer) {
          window.clearTimeout(this.expiryTimer);
          this.expiryTimer = null;
        }
      },

      async submit() {
        if (this.submitting || !this.numericTableId || !this.reviewUrl) {
          return;
        }

        this.submitting = true;
        try {
          const response = await fetch(this.reviewUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              rating: this.rating,
              comment: this.comment.trim() || undefined,
            }),
          });

          if (!response.ok) {
            throw new Error("Review submit failed");
          }

          this.closePrompt();
        } catch {
          // keep the prompt open for a second try
        } finally {
          this.submitting = false;
        }
      },
    };
  }

  function guestHub(configId) {
    const config = readJsonScript(configId);

    return {
      wifiOpen: false,
      wifiCopied: "idle",
      wifiName: config.wifiName || "",
      wifiPassword: config.wifiPassword || "",
      wifiQrUrl: config.wifiQrUrl || "",

      async copyWifiPassword() {
        try {
          await safeClipboardCopy(this.wifiPassword);
          this.wifiCopied = "password";
          window.setTimeout(() => {
            this.wifiCopied = "idle";
          }, 1800);
        } catch {
          this.wifiCopied = "idle";
        }
      },
    };
  }

  function menuPage(configId) {
    const config = readJsonScript(configId);
    const dishMap = buildDishMap(config.dishes);

    return {
      tableId: config.tableId || "",
      cat: config.initialCategory || "all",
      sheet: null,
      categories: Array.isArray(config.categories) ? config.categories : [],
      dishes: Array.isArray(config.dishes) ? config.dishes : [],
      lines: [],

      init() {
        this.lines = readCart(this.tableId);
      },

      get allCategories() {
        return [{ id: "all", labelRu: "Все" }].concat(this.categories);
      },

      get filteredDishes() {
        return this.dishes
          .filter((dish) => {
            if (dish.available === false) {
              return false;
            }

            return this.cat === "all" || dish.category === this.cat;
          })
          .map((dish) => ({
            ...dish,
            image: optimizeMenuImageUrl(dish.image, 640),
          }));
      },

      get totalQty() {
        return this.lines.reduce((sum, line) => sum + line.qty, 0);
      },

      formatPrice,

      setCategory(categoryId) {
        this.cat = categoryId;
      },

      openDish(dishId) {
        const dish = dishMap.get(dishId);
        if (!dish) {
          return;
        }

        const category = this.categories.find((item) => item.id === dish.category);
        this.sheet = {
          ...dish,
          image: optimizeMenuImageUrl(dish.image, 1200),
          category: category ? category.labelRu : "Меню",
        };
      },

      closeDish() {
        this.sheet = null;
      },

      qtyFor(dishId) {
        const line = this.lines.find((entry) => entry.dishId === dishId);
        return line ? line.qty : 0;
      },

      persist() {
        this.lines = writeCart(this.tableId, this.lines);
      },

      addDish(dishId) {
        const existing = this.lines.find((line) => line.dishId === dishId);
        if (existing) {
          existing.qty += 1;
        } else {
          this.lines.push({ dishId, qty: 1 });
        }
        this.persist();
      },

      setDishQty(dishId, qty) {
        if (qty <= 0) {
          this.lines = this.lines.filter((line) => line.dishId !== dishId);
          this.persist();
          return;
        }

        const existing = this.lines.find((line) => line.dishId === dishId);
        if (existing) {
          existing.qty = qty;
        } else {
          this.lines.push({ dishId, qty });
        }
        this.persist();
      },
    };
  }

  function publicMenuPage(configId) {
    const config = readJsonScript(configId);
    const dishMap = buildDishMap(config.dishes);

    return {
      selectedCategoryId: "",
      sheet: null,
      profile: config.profile || {},
      categories: Array.isArray(config.categories) ? config.categories : [],
      dishes: Array.isArray(config.dishes) ? config.dishes : [],

      get availableDishes() {
        return this.dishes.filter((dish) => dish && dish.available !== false);
      },

      get selectedCategory() {
        return this.categories.find((category) => category.id === this.selectedCategoryId) || null;
      },

      get selectedDishes() {
        return this.dishesForCategory(this.selectedCategoryId);
      },

      formatPrice,

      dishCount(categoryId) {
        return this.dishesForCategory(categoryId).length;
      },

      dishesForCategory(categoryId) {
        return this.availableDishes
          .filter((dish) => dish.category === categoryId)
          .map((dish) => ({
            ...dish,
            image: optimizeMenuImageUrl(dish.image, 720),
          }));
      },

      categoryCover(categoryId) {
        const dish = this.availableDishes.find((item) => item.category === categoryId);
        return optimizeMenuImageUrl((dish && dish.image) || this.profile.banner || this.profile.logo || "", 720);
      },

      categoryPreview(categoryId) {
        return this.dishesForCategory(categoryId)
          .slice(0, 3)
          .map((dish) => dish.nameRu)
          .join(" · ");
      },

      openCategory(categoryId) {
        this.selectedCategoryId = categoryId;
        this.sheet = null;
        window.scrollTo({ top: 0, behavior: "smooth" });
      },

      closeCategory() {
        this.selectedCategoryId = "";
        this.sheet = null;
        window.scrollTo({ top: 0, behavior: "smooth" });
      },

      openDish(dishId) {
        const dish = dishMap.get(dishId);
        if (!dish || dish.available === false) {
          return;
        }

        const category = this.categories.find((item) => item.id === dish.category);
        this.sheet = {
          ...dish,
          image: optimizeMenuImageUrl(dish.image, 1200),
          category: category ? category.labelRu : "Меню",
        };
      },

      closeDish() {
        this.sheet = null;
      },
    };
  }

  function cartPage(configId) {
    const config = readJsonScript(configId);
    const dishMap = buildDishMap(config.dishes);

    return {
      tableId: config.tableId || "",
      menuPath: config.menuPath || "",
      cartPath: config.cartPath || "",
      lines: [],
      submitting: false,
      errorMessage: "",

      init() {
        this.lines = readCart(this.tableId);
      },

      formatPrice,

      get resolvedLines() {
        return this.lines
          .map((line) => {
            const dish = dishMap.get(line.dishId);
            if (!dish) {
              return null;
            }

            return {
              dishId: line.dishId,
              qty: line.qty,
              image: optimizeMenuImageUrl(dish.image, 320),
              nameRu: dish.nameRu,
              price: Number(dish.price || 0),
            };
          })
          .filter(Boolean);
      },

      get totalQty() {
        return this.lines.reduce((sum, line) => sum + line.qty, 0);
      },

      get totalSum() {
        return this.resolvedLines.reduce((sum, line) => sum + line.price * line.qty, 0);
      },

      persist() {
        this.lines = writeCart(this.tableId, this.lines);
      },

      setQty(dishId, qty) {
        if (qty <= 0) {
          this.lines = this.lines.filter((line) => line.dishId !== dishId);
        } else {
          const existing = this.lines.find((line) => line.dishId === dishId);
          if (existing) {
            existing.qty = qty;
          } else {
            this.lines.push({ dishId, qty });
          }
        }

        this.persist();
      },

      async checkout() {
        if (this.submitting || this.lines.length === 0) {
          return;
        }

        this.submitting = true;
        this.errorMessage = "";

        try {
          const numericTableId = normalizeTableId(this.tableId);
          const items = this.resolvedLines.map((line) => ({
            dishId: line.dishId,
            title: line.nameRu,
            qty: line.qty,
            price: line.price,
          }));

          if (!numericTableId || items.length === 0) {
            throw new Error("Cart is invalid");
          }

          const response = await fetch(`/api/table/${numericTableId}/orders`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ items }),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error((payload && payload.error) || "Не удалось оформить заказ");
          }

          clearCart(this.tableId);
          this.lines = [];
          window.location.href = this.menuPath || this.cartPath || "/";
        } catch (error) {
          this.errorMessage = error instanceof Error ? error.message : "Не удалось оформить заказ";
        } finally {
          this.submitting = false;
        }
      },
    };
  }

  function formatCountdown(totalSeconds) {
    const safe = Math.max(Number(totalSeconds || 0), 0);
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function waiterPage(configId) {
    const config = readJsonScript(configId);

    return {
      tableId: config.tableId || "",
      requestType: config.requestType || "waiter",
      actionLabel: config.actionLabel || "Позвать официанта",
      cooldownUrl: config.cooldownUrl || "",
      requestUrl: config.requestUrl || "",
      nowMs: Date.now(),
      expiresAt: 0,
      timerError: "",
      tickInterval: null,

      init() {
        this.tickInterval = window.setInterval(() => {
          this.nowMs = Date.now();
        }, 1000);

        this.syncCooldown();
      },

      destroy() {
        if (this.tickInterval) {
          window.clearInterval(this.tickInterval);
          this.tickInterval = null;
        }
      },

      get remaining() {
        return Math.max(0, Math.ceil((this.expiresAt - this.nowMs) / 1000));
      },

      get requested() {
        return this.remaining > 0;
      },

      get canRecall() {
        return this.remaining === 0;
      },

      get progress() {
        if (!this.requested) {
          return 0;
        }

        return Math.min(1, Math.max(0, this.remaining / WAIT_SEC));
      },

      get dashOffset() {
        return RING_CIRCUMFERENCE * (1 - this.progress);
      },

      formatCountdown,

      async syncCooldown() {
        try {
          const response = await fetch(this.cooldownUrl, {
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error("Cooldown sync failed");
          }

          const payload = await response.json();
          this.expiresAt = Number(payload && payload.cooldown && payload.cooldown.availableAt) || 0;
          this.nowMs = Date.now();
          this.timerError = "";
        } catch {
          this.timerError = "Не удалось проверить состояние вызова.";
        }
      },

      async sendRequest() {
        if (this.requested && !this.canRecall) {
          return;
        }

        try {
          const response = await fetch(this.requestUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: this.requestType,
            }),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error((payload && payload.error) || "Не удалось отправить вызов");
          }

          const payload = await response.json();
          this.expiresAt = Number(payload && payload.cooldown && payload.cooldown.availableAt) || 0;
          this.nowMs = Date.now();
          this.timerError = "";
        } catch (error) {
          this.timerError = error instanceof Error ? error.message : "Не удалось отправить вызов";
        }
      },
    };
  }

  function registerAlpineData() {
    if (!window.Alpine || window.Alpine.__giottoGuestRegistered) {
      return;
    }

    window.Alpine.data("reviewPrompt", reviewPrompt);
    window.Alpine.data("guestHub", guestHub);
    window.Alpine.data("menuPage", menuPage);
    window.Alpine.data("publicMenuPage", publicMenuPage);
    window.Alpine.data("cartPage", cartPage);
    window.Alpine.data("waiterPage", waiterPage);
    window.Alpine.__giottoGuestRegistered = true;
  }

  document.addEventListener("alpine:init", registerAlpineData);
  registerAlpineData();
})();
