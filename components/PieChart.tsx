import classNames from "classnames";
import React, { useCallback, useState } from "react";
import { PieChart as MinimalPieChart } from "react-minimal-pie-chart";
import ReactTooltip from "react-tooltip";
import { v4 as uuidv4 } from "uuid";
import { ShowValuesContext } from "../pages";
import sty from "./PieChart.module.css";

export interface DataEntry {
  name: string | React.ReactElement;
  color: string;
  value: number;
}

interface PieChartProps {
  data: DataEntry[];
  className: string;
  onClick?: (index: number) => void;
}

export const PieChart = React.forwardRef<HTMLDivElement, PieChartProps>(
  function PieChart(props, ref) {
    const [noSSR, setNoSSR] = React.useState(false);
    const [hovered, setHovered] = useState<number | undefined>(undefined);
    const [chartId] = React.useState(() => uuidv4());
    const showValues = React.useContext(ShowValuesContext);

    React.useEffect(() => {
      setNoSSR(true);
    }, []);

    const [animate, setAnimate] = React.useState(true);
    const initialData = React.useRef(props.data);
    React.useEffect(() => {
      if (props.data !== initialData.current) {
        setAnimate(false);
      }
    }, [props.data]);

    const data = props.data.map((entry, i) =>
      hovered === i ? { ...entry, color: "grey" } : entry
    );

    const total = data.reduce((sum, entry) => sum + entry.value, 0);
    const makeTooltipContent = useCallback(
      (entry: DataEntry) => (
        <>
          {entry.name}
          <br />
          {`R$ ${
            showValues
              ? `${Intl.NumberFormat("pt-br", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(Math.round(entry.value * 100) / 100)}`
              : "*****"
          }`}
          <br />
          {`${Math.round((100 * entry.value) / total)}%`}
        </>
      ),
      [total, showValues]
    );

    return (
      <div
        ref={ref}
        {...(noSSR ? { "data-tip": "", "data-for": chartId } : {})}
        className={classNames(sty.pieChart, props.className)}
      >
        <MinimalPieChart
          animate={animate}
          data={data}
          lineWidth={40}
          labelStyle={(index) => ({
            fill: props.data[index].color,
            fontSize: "8px",
            fontFamily: "sans-serif",
          })}
          radius={42}
          segmentsStyle={{ cursor: "pointer" }}
          onClick={(_, index) => props.onClick?.(index)}
          onMouseOver={(_, index) => {
            setHovered(index);
          }}
          onMouseOut={() => {
            setHovered(undefined);
          }}
          startAngle={-90}
        />
        {noSSR && (
          <ReactTooltip
            id={chartId}
            multiline
            type="light"
            getContent={() =>
              typeof hovered === "number" && data[hovered]
                ? makeTooltipContent(data[hovered])
                : null
            }
          />
        )}
      </div>
    );
  }
);
