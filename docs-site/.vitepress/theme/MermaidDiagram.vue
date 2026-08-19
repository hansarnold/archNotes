<script setup>
import { onMounted, ref } from "vue";

const props = defineProps({ code: { type: String, required: true } });
const root = ref(null);
const failed = ref(false);

onMounted(async () => {
  try {
    const bytes = Uint8Array.from(atob(props.code), (character) => character.charCodeAt(0));
    const source = new TextDecoder().decode(bytes);
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: document.documentElement.classList.contains("dark") ? "dark" : "neutral",
      fontFamily: "system-ui, sans-serif",
    });
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    const { svg } = await mermaid.render(id, source);
    root.value.innerHTML = svg;
  } catch (error) {
    failed.value = true;
    console.error("Unable to render Mermaid diagram", error);
  }
});
</script>

<template>
  <div ref="root" class="mermaid-diagram" :class="{ 'is-error': failed }">
    <p v-if="failed">This diagram could not be rendered.</p>
  </div>
</template>

<style scoped>
.mermaid-diagram {
  margin: 24px 0;
  overflow-x: auto;
  text-align: center;
}

.mermaid-diagram :deep(svg) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}
</style>
