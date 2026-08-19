import os

import networkx as nx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(title="CyberSim Network Engine")

INTERNAL_SECRET = os.environ.get("NETWORK_ENGINE_SECRET")


def require_internal_auth(x_internal_secret: str | None) -> None:
    if not INTERNAL_SECRET or x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


class TopologyNode(BaseModel):
    id: str
    type: str


class TopologyEdge(BaseModel):
    source: str
    target: str


class Topology(BaseModel):
    nodes: list[TopologyNode]
    edges: list[TopologyEdge]


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/simulate/reachability")
def reachability(topology: Topology, source: str, target: str, x_internal_secret: str | None = Header(default=None)):
    require_internal_auth(x_internal_secret)

    graph = nx.Graph()
    graph.add_nodes_from(n.id for n in topology.nodes)
    graph.add_edges_from((e.source, e.target) for e in topology.edges)

    if source not in graph or target not in graph:
        raise HTTPException(status_code=400, detail="Unknown node")

    reachable = nx.has_path(graph, source, target)
    path = nx.shortest_path(graph, source, target) if reachable else []
    return {"reachable": reachable, "path": path}
