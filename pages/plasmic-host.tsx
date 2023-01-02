import { PlasmicCanvasHost, registerComponent } from "@plasmicapp/host";
import { PieChart } from "../components/PieChart";

registerComponent(PieChart, {
  name: "PieChart",
  displayName: "Pie Chart",
  importPath: "./components/PieChart",
  props: {
    data: {
      type: "object",
      hidden: () => true,
      defaultValue: [
        { name: "One", value: 10, color: "#E38627" },
        { name: "Two", value: 15, color: "#C13C37" },
        { name: "Three", value: 20, color: "#6A2135" },
      ],
    },
  },
});

export default function PlasmicHost() {
  return <PlasmicCanvasHost />;
}
