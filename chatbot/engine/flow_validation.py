from __future__ import annotations

from typing import Any, Dict, List, Set


def _node_edges(node: Dict[str, Any]) -> List[str]:
    edges: List[str] = []
    nxt = node.get("next")
    if isinstance(nxt, str) and nxt.strip() and nxt != "handoff":
        edges.append(nxt.strip())

    options = node.get("options")
    if isinstance(options, list):
        for opt in options:
            if not isinstance(opt, dict):
                continue
            target = opt.get("next")
            if isinstance(target, str) and target.strip() and target != "handoff":
                edges.append(target.strip())

    return edges


def _is_waiting_node(node: Dict[str, Any]) -> bool:
    """Return True when a node expects user input before transitioning."""
    input_type = str(node.get("input_type", "text")).strip().lower()
    return input_type in {"text", "quick_reply"}


def validate_flow_definition(flow: Dict[str, Any]) -> List[str]:
    errors: List[str] = []

    nodes_raw = flow.get("nodes")
    if not isinstance(nodes_raw, list) or len(nodes_raw) == 0:
        return ["Flow must include a non-empty nodes array."]

    nodes: List[Dict[str, Any]] = [n for n in nodes_raw if isinstance(n, dict)]
    if len(nodes) != len(nodes_raw):
        errors.append("All nodes must be JSON objects.")

    node_ids: List[str] = []
    for idx, node in enumerate(nodes):
        node_id = node.get("id")
        if not isinstance(node_id, str) or not node_id.strip():
            errors.append(f"Node at index {idx} is missing a valid id.")
            continue
        node_ids.append(node_id.strip())

    if not node_ids:
        return errors

    node_id_set: Set[str] = set(node_ids)
    if len(node_id_set) != len(node_ids):
        seen: Set[str] = set()
        dupes: Set[str] = set()
        for nid in node_ids:
            if nid in seen:
                dupes.add(nid)
            seen.add(nid)
        errors.append(f"Duplicate node ids found: {', '.join(sorted(dupes))}.")

    edge_map: Dict[str, List[str]] = {nid: [] for nid in node_id_set}
    missing_targets: Set[str] = set()

    for node in nodes:
        node_id = str(node.get("id", "")).strip()
        if not node_id:
            continue
        edges = _node_edges(node)
        edge_map[node_id] = edges
        for target in edges:
            if target not in node_id_set:
                missing_targets.add(target)

    if missing_targets:
        errors.append(f"Missing next-node targets: {', '.join(sorted(missing_targets))}.")

    # Dead ends: nodes that cannot transition anywhere and are not explicit human handoff nodes.
    dead_ends: List[str] = []
    for node in nodes:
        node_id = str(node.get("id", "")).strip()
        if not node_id:
            continue
        has_handoff = node.get("next") == "handoff"
        options = node.get("options")
        if isinstance(options, list):
            has_handoff = has_handoff or any(isinstance(o, dict) and o.get("next") == "handoff" for o in options)

        if len(edge_map.get(node_id, [])) == 0 and not has_handoff:
            dead_ends.append(node_id)

    if dead_ends:
        errors.append(f"Dead-end nodes found: {', '.join(sorted(dead_ends))}.")

    # Cycles are valid in conversational flows when user input is required.
    # We only reject strongly connected components that are fully automatic,
    # because those can loop indefinitely during node auto-delivery.
    node_by_id: Dict[str, Dict[str, Any]] = {
        str(node.get("id", "")).strip(): node
        for node in nodes
        if isinstance(node.get("id"), str) and str(node.get("id", "")).strip()
    }

    index = 0
    index_by_id: Dict[str, int] = {}
    lowlink_by_id: Dict[str, int] = {}
    stack: List[str] = []
    on_stack: Set[str] = set()
    bad_cycle_nodes: Set[str] = set()

    def strongconnect(nid: str) -> None:
        nonlocal index
        index_by_id[nid] = index
        lowlink_by_id[nid] = index
        index += 1
        stack.append(nid)
        on_stack.add(nid)

        for nxt in edge_map.get(nid, []):
            if nxt not in index_by_id:
                strongconnect(nxt)
                lowlink_by_id[nid] = min(lowlink_by_id[nid], lowlink_by_id[nxt])
            elif nxt in on_stack:
                lowlink_by_id[nid] = min(lowlink_by_id[nid], index_by_id[nxt])

        if lowlink_by_id[nid] == index_by_id[nid]:
            component: List[str] = []
            while True:
                member = stack.pop()
                on_stack.remove(member)
                component.append(member)
                if member == nid:
                    break

            has_cycle = len(component) > 1 or nid in edge_map.get(nid, [])
            if not has_cycle:
                return

            all_automatic = all(not _is_waiting_node(node_by_id.get(member, {})) for member in component)
            if all_automatic:
                bad_cycle_nodes.update(component)

    for nid in node_id_set:
        if nid not in index_by_id:
            strongconnect(nid)

    if bad_cycle_nodes:
        errors.append(
            "Unsafe automatic cycle detected around: "
            + ", ".join(sorted(bad_cycle_nodes))
            + "."
        )

    return errors


def validate_flow_json_text(flow_json: str) -> List[str]:
    import json

    try:
        flow = json.loads(flow_json)
    except Exception as exc:
        return [f"Invalid JSON: {exc}"]

    if not isinstance(flow, dict):
        return ["Flow JSON root must be an object."]

    return validate_flow_definition(flow)
