import DefaultTheme from "vitepress/theme";
import TechnicalDiagram from "./TechnicalDiagram.vue";
import "./technical-diagram.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("TechnicalDiagram", TechnicalDiagram);
  },
};
