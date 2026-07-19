import { createPlugin, lazyComponent } from "@lattice-php/lattice";

export default createPlugin({
  name: "lattice/tree",
  components: {
    tree: lazyComponent(() => import("./tree")),
  },
  i18n: {
    namespace: "tree",
  },
});
