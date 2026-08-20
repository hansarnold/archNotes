<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useId } from "vue";
import { useData, withBase } from "vitepress";
import {
  getReturnFocusTarget,
  restoreDiagramScrollPosition,
  setDiagramScrollLocked,
} from "./technical-diagram-focus.mjs";

const props = defineProps({
  alt: { type: String, required: true },
  caption: { type: String, required: true },
  rawHref: { type: String, required: true },
  src: { type: String, required: true },
});

const { lang } = useData();
const dialog = ref(null);
const opener = ref(null);
const instanceId = `technical-diagram-${useId().replaceAll(":", "")}`;
const captionId = `${instanceId}-caption`;
const descriptionId = `${instanceId}-description`;
const dialogTitleId = `${instanceId}-dialog-title`;
const dialogDescriptionId = `${instanceId}-dialog-description`;
let returnFocusTo = null;
let restoreFocusFrame = null;

const labels = computed(() => {
  const chinese = String(lang.value || "").toLowerCase().startsWith("zh");
  return chinese
    ? { close: "关闭图表", open: "查看大图", raw: "打开原始 SVG" }
    : { close: "Close diagram", open: "View full-size diagram", raw: "Open raw SVG" };
});

const sourceUrl = computed(() => withBase(props.src));
const rawUrl = computed(() => withBase(props.rawHref));
const hasDistinctDescription = computed(() => props.alt.trim() !== props.caption.trim());

const open = async () => {
  const element = dialog.value;
  if (!element || typeof element.showModal !== "function") {
    window.location.assign(rawUrl.value);
    return;
  }

  returnFocusTo = getReturnFocusTarget(document.activeElement, document);
  if (!element.open) element.showModal();
  setDiagramScrollLocked(document, true);
  await nextTick();
  element.querySelector(".technical-diagram__close")?.focus({ preventScroll: true });
};

const close = () => dialog.value?.close();

const closeFromBackdrop = (event) => {
  if (event.target === event.currentTarget) close();
};

const closeFromCancel = (event) => {
  event.preventDefault();
  close();
};

const restoreFocus = async () => {
  const target = returnFocusTo || opener.value;
  returnFocusTo = null;
  const restoredScroll = setDiagramScrollLocked(document, false);
  await nextTick();
  restoreFocusFrame = window.requestAnimationFrame(() => {
    if (target?.isConnected !== false) target?.focus?.({ preventScroll: true });
    restoreDiagramScrollPosition(document, restoredScroll);
    restoreFocusFrame = window.requestAnimationFrame(() => {
      restoreFocusFrame = null;
      restoreDiagramScrollPosition(document, restoredScroll);
    });
  });
};

onBeforeUnmount(() => {
  if (restoreFocusFrame !== null) window.cancelAnimationFrame(restoreFocusFrame);
  if (dialog.value?.open) dialog.value.close();
  setDiagramScrollLocked(document, false);
});
</script>

<template>
  <figure
    class="technical-diagram"
    :aria-labelledby="captionId"
    :aria-describedby="hasDistinctDescription ? descriptionId : undefined"
  >
    <button
      ref="opener"
      type="button"
      class="technical-diagram__trigger"
      :aria-label="`${labels.open}: ${caption}`"
      aria-haspopup="dialog"
      @click="open"
    >
      <span class="technical-diagram__surface">
        <img class="technical-diagram__inline-image" :src="sourceUrl" alt="">
      </span>
      <span class="technical-diagram__zoom-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5M3 8l6-6M21 8l-6-6M3 16l6 6M21 16l-6 6" />
        </svg>
      </span>
    </button>

    <figcaption :id="captionId" class="technical-diagram__caption">
      <span>{{ caption }}</span>
      <a class="technical-diagram__raw-link" :href="rawUrl">{{ labels.raw }}</a>
    </figcaption>
    <span
      v-if="hasDistinctDescription"
      :id="descriptionId"
      class="technical-diagram__description"
    >{{ alt }}</span>

    <dialog
      ref="dialog"
      class="technical-diagram__dialog"
      :aria-labelledby="dialogTitleId"
      :aria-describedby="hasDistinctDescription ? dialogDescriptionId : undefined"
      @click="closeFromBackdrop"
      @close="restoreFocus"
      @cancel="closeFromCancel"
      @keydown.esc.stop.prevent="close"
    >
      <div class="technical-diagram__dialog-panel">
        <header class="technical-diagram__dialog-header">
          <p :id="dialogTitleId">{{ caption }}</p>
          <button
            type="button"
            class="technical-diagram__close"
            :aria-label="labels.close"
            @click="close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <span
          v-if="hasDistinctDescription"
          :id="dialogDescriptionId"
          class="technical-diagram__description"
        >{{ alt }}</span>
        <div class="technical-diagram__viewport" tabindex="0">
          <img class="technical-diagram__detail-image" :src="sourceUrl" alt="">
        </div>
      </div>
    </dialog>
  </figure>
</template>
