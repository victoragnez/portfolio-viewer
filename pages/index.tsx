import * as ph from "@plasmicapp/host";
import { promises as fs } from "fs";
import path from "path";
import * as React from "react";

import EyeInvisibleOutlined from "@ant-design/icons/EyeInvisibleOutlined";
import EyeOutlined from "@ant-design/icons/EyeOutlined";

import { computed, runInAction } from "mobx";
import { observer } from "mobx-react-lite";
import { GetStaticPropsResult } from "next";
import { useRouter } from "next/router";
import ReactTooltip from "react-tooltip";
import AssetGroupChart from "../components/AssetGroupChart";
import { DataEntry } from "../components/PieChart";
import { PlasmicHome } from "../components/plasmic/consolidador_de_carteira/PlasmicHome";
import { swallowAsync } from "../utils/common";
import {
  AssetGroup,
  AssetNode,
  GroupNode,
  Node,
  validateAndFetchData,
} from "../utils/data-model";

export async function getStaticProps(): Promise<
  GetStaticPropsResult<HomeProps>
> {
  let contents = await swallowAsync(() =>
    fs.readFile(path.join(process.cwd(), "data.json"), "utf8")
  );
  const exampleData = !contents;
  contents =
    contents ||
    (await fs.readFile(path.join(process.cwd(), "data_example.json"), "utf8"));
  const data: AssetGroup = JSON.parse(contents);
  const rootNode = await validateAndFetchData(data);
  return {
    props: { rootNode: rootNode.toSerializable(), exampleData },
    revalidate: 300,
  };
}

interface HomeProps {
  rootNode: GroupNode;
  exampleData: boolean;
}

export const ShowValuesContext = React.createContext(true);

const Home = observer(function Home({ rootNode, exampleData }: HomeProps) {
  const [multiLine, setMultiLine] = React.useState(false);
  const [showValues, setShowValues] = React.useState(true);
  const [noSSR, setNoSSR] = React.useState(false);

  React.useEffect(() => {
    setNoSSR(true);
  }, []);

  const tree = React.useMemo(
    () => GroupNode.fromSerializable(rootNode),
    [rootNode]
  );

  const renderChartsComputed = React.useMemo(
    () => computed(() => renderCharts(tree, { multiLine })),
    [tree, multiLine]
  );

  const rows = renderChartsComputed.get();

  return (
    <ph.PageParamsProvider
      params={useRouter()?.query}
      query={useRouter()?.query}
    >
      <ShowValuesContext.Provider value={showValues}>
        <PlasmicHome
          exampleData={exampleData}
          balanceContainer={{
            wrapChildren: (children) => (
              <>
                {children}
                {showValues ? (
                  <EyeOutlined
                    onClick={() => setShowValues(!showValues)}
                    style={{ marginLeft: 8 }}
                  />
                ) : (
                  <EyeInvisibleOutlined
                    onClick={() => setShowValues(!showValues)}
                    style={{ marginLeft: 8 }}
                  />
                )}
              </>
            ),
          }}
          balanceValue={{
            ...(showValues
              ? {
                  children: `${Intl.NumberFormat("pt-br", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(Math.round(tree.value * 100) / 100)}`,
                }
              : {}),
          }}
          multiLine={{
            props: {
              isChecked: multiLine,
              onChange: (v) => setMultiLine(v),
            },
            wrap: (elt) => (
              <div
                {...(noSSR
                  ? {
                      "data-tip":
                        "Permite que múltiplos grupos de ativos sejam expandidos simultaneamente",
                      "data-for": "multiline-tooltip",
                    }
                  : {})}
              >
                {elt}
                {noSSR && (
                  <ReactTooltip
                    id={"multiline-tooltip"}
                    type="light"
                    effect="solid"
                    multiline
                    delayShow={750}
                    delayHide={250}
                  />
                )}
              </div>
            ),
          }}
          contents={{
            render: (props, Comp) => {
              return (
                <>
                  {rows.map((row, i) => (
                    <Comp key={i} {...props}>
                      {row}
                    </Comp>
                  ))}
                </>
              );
            },
          }}
        />
      </ShowValuesContext.Provider>
    </ph.PageParamsProvider>
  );
});

function renderCharts(
  root: GroupNode,
  opts: { multiLine?: boolean }
): React.ReactElement[][] {
  type Data = DataEntry & {
    node: Node;
  };
  const nodeToParent = new Map<Node, GroupNode>();
  const dfs = (node: GroupNode) => {
    node.children.forEach(([child]) => {
      nodeToParent.set(child, node);
      if (child instanceof GroupNode) {
        dfs(child);
      }
    });
  };
  dfs(root);

  const rec = (node: GroupNode) => {
    const rows: React.ReactElement[][] = [];
    const data: Data[] = [];

    let firstOpenChild = true;
    node.children.forEach(([child, color]) => {
      if (
        !opts.multiLine &&
        child instanceof GroupNode &&
        child.isOpen &&
        !firstOpenChild
      ) {
        runInAction(() => (child.isOpen = false));
      }
      if (!(child instanceof GroupNode) || !child.isOpen) {
        data.push({
          color,
          value: child.value,
          name:
            child instanceof AssetNode &&
            child.asset.type === "crypto-currency" ? (
              <>{child.name} - Powered by CoinGecko</>
            ) : (
              child.name
            ),
          node: child,
        });
        return;
      }
      const childRes = rec(child);
      rows.push(...childRes.rows);
      data.push(...childRes.data);
      firstOpenChild = false;
    });
    const elt = (
      <AssetGroupChart
        key={node.name}
        groupName={node.name}
        chart={{
          data,
          onClick: (index) => {
            runInAction(() => {
              if (data[index]) {
                const clickedNode = data[index].node;
                if (clickedNode instanceof GroupNode) {
                  clickedNode.isOpen = true;
                  if (!opts.multiLine) {
                    const parent = nodeToParent.get(clickedNode);
                    parent?.children.forEach(([child]) => {
                      if (
                        child !== clickedNode &&
                        child instanceof GroupNode &&
                        child.isOpen
                      ) {
                        child.isOpen = false;
                      }
                    });
                  }
                } else {
                  const child = node.children.find(
                    ([c]) => c.name === clickedNode.path[node.path.length + 1]
                  )?.[0];
                  if (child instanceof GroupNode) {
                    closeSubtree(child);
                  }
                }
              }
            });
          },
        }}
      />
    );
    if (rows.length === 0) {
      rows.push([elt]);
    } else {
      rows.forEach((row, i) => {
        if (i === 0) {
          row.unshift(elt);
        } else {
          row.unshift(
            <AssetGroupChart
              key={row.length + 1}
              root={{ style: { opacity: 0 } }}
            />
          );
        }
      });
    }
    return { rows, data };
  };
  return rec(root).rows;
}

function closeSubtree(node: GroupNode) {
  node.isOpen = false;
  node.children.forEach(
    ([child]) => child instanceof GroupNode && closeSubtree(child)
  );
}

export default Home;
