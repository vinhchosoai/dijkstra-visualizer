
interface AdjacencyEdge {
  to: string;
  weight: number;
}

type AdjacencyList = Map<string, AdjacencyEdge[]>;

export interface DijkstraHooks {
  onVisitNode: (nodeId: string) => Promise<void>;
  onUpdateDistance: (nodeId: string, newDistance: number) => Promise<void>;
  onFinalizeNode: (nodeId: string) => Promise<void>;
}

type PQItem = {
  nodeId: string;
  distance: number;
};

class SimplePriorityQueue {
  private items: PQItem[] = [];

  push(item: PQItem): void {
    const existingIndex = this.items.findIndex(i => i.nodeId === item.nodeId);

    if (existingIndex > -1) {
      if (this.items[existingIndex].distance > item.distance) {
        this.items[existingIndex].distance = item.distance;
      }
    } else {
      this.items.push(item);
    }
  }

  pop(): PQItem | undefined {
    if (this.isEmpty()) {
      return undefined;
    }

    let minIndex = 0;
    for (let i = 1; i < this.items.length; i++) {
      if (this.items[i].distance < this.items[minIndex].distance) {
        minIndex = i;
      }
    }

    const [item] = this.items.splice(minIndex, 1);
    return item;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

export async function visualizeDijkstra(
  graph: AdjacencyList,
  startNodeId: string,
  hooks: DijkstraHooks
): Promise<Map<string, number>> {

  const distances = new Map<string, number>();
  const visited = new Set<string>();
  const pq = new SimplePriorityQueue();

  for (const nodeId of graph.keys()) {
    distances.set(nodeId, Infinity);
  }

  distances.set(startNodeId, 0);
  pq.push({ nodeId: startNodeId, distance: 0 });

  await hooks.onUpdateDistance(startNodeId, 0);

  while (!pq.isEmpty()) {
    const { nodeId, distance } = pq.pop()!;

    if (visited.has(nodeId)) {
      continue;
    }

    visited.add(nodeId);
    await hooks.onVisitNode(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const edge of neighbors) {
      if (visited.has(edge.to)) {
        continue;
      }

      const newDist = distance + edge.weight;

      if (newDist < (distances.get(edge.to) || Infinity)) {
        distances.set(edge.to, newDist);
        pq.push({ nodeId: edge.to, distance: newDist });
        await hooks.onUpdateDistance(edge.to, newDist);
      }
    }

    await hooks.onFinalizeNode(nodeId);
  }

  console.log("Dijkstra finished: ", distances);
  return distances;
}
// --- 4. ĐỊNH NGHĨA TRẠNG THÁI GIAO DIỆN (UI STATE) ---
// Tách biệt với logic thuật toán

interface Node {
  id: string;
  x: number;
  y: number;
}

interface Edge {
  id: string;
  from: string; // Node ID
  to: string;   // Node ID
  weight: number;
}

// Trạng thái của ứng dụng
let nodes = new Map<string, Node>();
let edges = new Map<string, Edge>();
let nodeCounter = 0;
let startNodeId: string | null = null;
let isSettingStart = false;
let isAddingEdge = false;
let edgeAddStep: 'none' | 'start' | 'end' = 'none';
let tempEdgeStartNodeId: string | null = null;
let isRunning = false;

// Trạng thái Canvas
const canvas = document.getElementById('graph-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const statusText = document.getElementById('status-text')!;

// --- 5. CÀI ĐẶT CANVAS & HÀM TIỆN ÍCH ---

function resizeCanvas() {
  const container = document.getElementById('canvas-container')!;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  drawGraph();
}

// Hàm sleep (Rất quan trọng cho việc minh họa)
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Cập nhật thông báo trạng thái
function updateStatus(text: string, isError: boolean = false) {
  statusText.textContent = text;
  statusText.style.color = isError ? '#f44336' : '#ffc107';
}

// Lấy một nút dựa trên tọa độ click
function getNodeAt(x: number, y: number): Node | null {
  for (const node of nodes.values()) {
    const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
    if (dist < 20) { // Kích thước bán kính nút
      return node;
    }
  }
  return null;
}

// --- 6. HÀM VẼ (DRAWING FUNCTIONS) ---

const NODE_RADIUS = 15;
const NODE_COLOR = '#4c8bf5';
const NODE_VISITED_COLOR = '#f4b400'; // Vàng
const NODE_FINALIZED_COLOR = '#0f9d58'; // Xanh lá
const NODE_START_COLOR = '#db4437'; // Đỏ
const EDGE_COLOR = '#999';
const EDGE_VISITED_COLOR = '#f4b400';

// Hàm vẽ chính (vẽ lại mọi thứ)
function drawGraph() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Vẽ các cạnh
  for (const edge of edges.values()) {
    const fromNode = nodes.get(edge.from)!;
    const toNode = nodes.get(edge.to)!;
    drawEdge(fromNode, toNode, edge.weight, EDGE_COLOR);
  }

  // 2. Vẽ các đỉnh
  for (const node of nodes.values()) {
    let color = NODE_COLOR;
    if (node.id === startNodeId) {
      color = NODE_START_COLOR;
    }
    drawNode(node, color);
  }
}

// Hàm vẽ một đỉnh
function drawNode(node: Node, color: string, distance?: number) {
  // Vẽ vòng tròn
  ctx.beginPath();
  ctx.arc(node.x, node.y, NODE_RADIUS, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Vẽ tên đỉnh (ID)
  ctx.fillStyle = '#fff';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.id, node.x, node.y);

  // Vẽ khoảng cách (nếu có)
  if (distance !== undefined) {
    ctx.fillStyle = '#ffc107';
    ctx.font = '16px Arial';
    ctx.fillText(String(distance), node.x, node.y + NODE_RADIUS + 15);
  }
}

// Hàm vẽ một cạnh
function drawEdge(from: Node, to: Node, weight: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Vẽ trọng số
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  ctx.fillStyle = '#fff';
  ctx.font = '14px Arial';
  ctx.fillText(String(weight), midX, midY - 8);
}

// --- 7. LẮNG NGHE SỰ KIỆN (EVENT LISTENERS) ---

// Lấy các nút bấm
const btnAddNode = document.getElementById('btn-add-node') as HTMLButtonElement;
const btnAddEdge = document.getElementById('btn-add-edge') as HTMLButtonElement;
const btnSetStart = document.getElementById('btn-set-start') as HTMLButtonElement;
const btnRun = document.getElementById('btn-run') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;

// Tắt các chế độ khác khi bật một chế độ
function resetModes() {
  isSettingStart = false;
  isAddingEdge = false;
  edgeAddStep = 'none';
  tempEdgeStartNodeId = null;
  btnAddNode.style.backgroundColor = '';
  btnAddEdge.style.backgroundColor = '';
  btnSetStart.style.backgroundColor = '';
}

// Thêm đỉnh
btnAddNode.addEventListener('click', () => {
  resetModes();
  btnAddNode.style.backgroundColor = '#4c8bf5'; // Đánh dấu là đang active
  updateStatus('Click lên canvas để thêm đỉnh mới.');
});

// Thêm cạnh
btnAddEdge.addEventListener('click', () => {
  resetModes();
  isAddingEdge = true;
  edgeAddStep = 'start';
  btnAddEdge.style.backgroundColor = '#4c8bf5';
  updateStatus('Bước 1/2: Click vào đỉnh BẮT ĐẦU của cạnh.');
});

// Chọn đỉnh bắt đầu
btnSetStart.addEventListener('click', () => {
  resetModes();
  isSettingStart = true;
  btnSetStart.style.backgroundColor = '#4c8bf5';
  updateStatus('Click vào một đỉnh để chọn làm điểm bắt đầu.');
});

// Chạy thuật toán
btnRun.addEventListener('click', () => {
  if (isRunning || !startNodeId) return;
  runAlgorithm();
});

// Reset
btnReset.addEventListener('click', () => {
  nodes.clear();
  edges.clear();
  nodeCounter = 0;
  startNodeId = null;
  resetModes();
  btnRun.disabled = true;
  isRunning = false;
  drawGraph();
  updateStatus('Đã reset. Chọn một hành động.');
});

// Xử lý click lên Canvas
canvas.addEventListener('click', (e) => {
  if (isRunning) return;

  // Lấy tọa độ click tương đối so với canvas
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const clickedNode = getNodeAt(x, y);

  if (isSettingStart) {
    // --- CHẾ ĐỘ CHỌN ĐỈNH BẮT ĐẦU ---
    if (clickedNode) {
      startNodeId = clickedNode.id;
      btnRun.disabled = false; // Mở khóa nút Run
      updateStatus(`Đã chọn đỉnh ${startNodeId} làm điểm bắt đầu. Sẵn sàng chạy!`);
      resetModes();
      drawGraph();
    }
  } else if (isAddingEdge) {
    // --- CHẾ ĐỘ THÊM CẠNH ---
    if (!clickedNode) return;

    if (edgeAddStep === 'start') {
      tempEdgeStartNodeId = clickedNode.id;
      edgeAddStep = 'end';
      updateStatus(`Bước 2/2: Click vào đỉnh KẾT THÚC của cạnh.`);
    } else {
      // (edgeAddStep === 'end')
      if (clickedNode.id === tempEdgeStartNodeId) return; // Không nối với chính nó

      const weight = parseInt(prompt(`Nhập trọng số cho cạnh (${tempEdgeStartNodeId} -> ${clickedNode.id}):`, '1') || '1', 10);
      
      if (weight <= 0) {
        alert("Trọng số phải là số dương (Dijkstra không chạy với trọng số âm).");
        return;
      }

      const edgeId = `${tempEdgeStartNodeId}->${clickedNode.id}`;
      edges.set(edgeId, {
        id: edgeId,
        from: tempEdgeStartNodeId!,
        to: clickedNode.id,
        weight: weight
      });
      
      resetModes();
      updateStatus(`Đã thêm cạnh ${edgeId}.`);
      drawGraph();
    }
  } else {
    // --- CHẾ ĐỘ THÊM ĐỈNH (Mặc định) ---
    if (!clickedNode) {
      const newNodeId = String(nodeCounter++);
      nodes.set(newNodeId, { id: newNodeId, x, y });
      drawGraph();
      updateStatus(`Đã thêm đỉnh ${newNodeId}.`);
    }
  }
});

// Khởi tạo
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Vẽ lần đầu

// --- 8. LOGIC CHẠY THUẬT TOÁN (Kết nối UI và Logic) ---

async function runAlgorithm() {
  isRunning = true;
  btnRun.disabled = true;
  resetModes();
  updateStatus('Thuật toán đang chạy...');
  
  // 1. Xây dựng AdjacencyList từ UI state
  const graph: AdjacencyList = new Map();
  for (const nodeId of nodes.keys()) {
    graph.set(nodeId, []); // Đảm bảo mọi đỉnh đều có trong graph
  }
  for (const edge of edges.values()) {
    graph.get(edge.from)!.push({ to: edge.to, weight: edge.weight });
    // Nếu là đồ thị vô hướng, thêm cả cạnh ngược lại:
    // graph.get(edge.to)!.push({ from: edge.from, weight: edge.weight });
  }

  // 2. Tạo bản đồ khoảng cách ban đầu trên UI
  const uiDistances = new Map<string, number>();
  for (const nodeId of nodes.keys()) {
    uiDistances.set(nodeId, Infinity);
  }
  uiDistances.set(startNodeId!, 0);

  // 3. Triển khai các HOOKS (Phần quan trọng)
  const dijkstraHooks: DijkstraHooks = {
    
    // Khi một đỉnh được LẤY RA khỏi PQ (tô màu vàng)
    onVisitNode: async (nodeId) => {
      const node = nodes.get(nodeId)!;
      drawNode(node, NODE_VISITED_COLOR, uiDistances.get(nodeId));
      updateStatus(`Đang xét đỉnh: ${nodeId} (khoảng cách ${uiDistances.get(nodeId)})`);
      await sleep(500); // TẠM DỪNG 0.5 giây
    },

    // Khi cập nhật khoảng cách (tô màu cạnh, cập nhật số)
    onUpdateDistance: async (nodeId, newDistance) => {
      uiDistances.set(nodeId, newDistance);
      // Vẽ lại toàn bộ để cập nhật số
      drawGraph(); 
      // Vẽ lại các đỉnh đã xử lý (vì drawGraph reset màu)
      for(const id of uiDistances.keys()) {
        if(uiDistances.get(id) !== Infinity) {
            drawNode(nodes.get(id)!, NODE_VISITED_COLOR, uiDistances.get(id));
        }
      }
      updateStatus(`Cập nhật: Khoảng cách đến ${nodeId} là ${newDistance}`);
      await sleep(300); // TẠM DỪNG 0.3 giây
    },

    // Khi một đỉnh XỬ LÝ XONG (tô màu xanh lá)
    onFinalizeNode: async (nodeId) => {
      const node = nodes.get(nodeId)!;
      drawNode(node, NODE_FINALIZED_COLOR, uiDistances.get(nodeId));
      await sleep(300); // TẠM DỪNG 0.3 giây
    }
  };

  // 4. CHẠY THUẬT TOÁN
  try {
    const finalDistances = await visualizeDijkstra(graph, startNodeId!, dijkstraHooks);
    
    // Tô màu lại tất cả các nút đã xong
    for (const [nodeId, dist] of finalDistances.entries()) {
      if (dist !== Infinity) {
        drawNode(nodes.get(nodeId)!, NODE_FINALIZED_COLOR, dist);
      }
    }
    updateStatus('Hoàn tất!');
  } catch (error) {
    console.error(error);
    updateStatus('Thuật toán gặp lỗi!', true);
  }

  isRunning = false;
  btnReset.disabled = false; // Cho phép reset sau khi chạy xong
}