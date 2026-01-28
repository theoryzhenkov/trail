import {setIcon} from "obsidian";

/**
 * Data key used to identify drag-and-drop operations for reordering
 */
const DRAG_DATA_TYPE = "text/trail-reorder-index";

/**
 * Sets up drag-and-drop reordering for a section element.
 * 
 * @param handleContainer - Element where the drag handle icon will be added
 * @param draggableEl - The element that will be draggable (typically the details element)
 * @param index - Current index of this item in the array
 * @param array - The array being reordered
 * @param onReorder - Callback when reorder completes
 */
export function setupDragReorder<T>(
	handleContainer: HTMLElement,
	draggableEl: HTMLElement,
	index: number,
	array: T[],
	onReorder: () => void
): void {
	// Create drag handle
	const handle = handleContainer.createDiv({
		cls: "trail-drag-handle",
		attr: {"aria-label": "Drag to reorder"}
	});
	setIcon(handle, "grip-vertical");

	// Make the element draggable
	draggableEl.draggable = true;
	draggableEl.dataset.reorderIndex = String(index);

	// Track if drag started from handle
	let dragStartedFromHandle = false;

	handle.addEventListener("mousedown", () => {
		dragStartedFromHandle = true;
	});

	handle.addEventListener("mouseup", () => {
		dragStartedFromHandle = false;
	});

	draggableEl.addEventListener("dragstart", (e) => {
		// Only allow drag if started from handle
		if (!dragStartedFromHandle) {
			e.preventDefault();
			return;
		}

		e.stopPropagation();
		draggableEl.dataset.dragging = "true";
		
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData(DRAG_DATA_TYPE, String(index));
		}
	});

	draggableEl.addEventListener("dragend", (e) => {
		e.stopPropagation();
		delete draggableEl.dataset.dragging;
		dragStartedFromHandle = false;
		
		// Clean up any drag-over states
		document.querySelectorAll(".trail-drag-over").forEach((el) => {
			el.classList.remove("trail-drag-over");
		});
	});

	draggableEl.addEventListener("dragover", (e) => {
		e.preventDefault();
		e.stopPropagation();
		
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = "move";
		}

		// Add visual feedback
		draggableEl.classList.add("trail-drag-over");
	});

	draggableEl.addEventListener("dragleave", (e) => {
		e.stopPropagation();
		draggableEl.classList.remove("trail-drag-over");
	});

	draggableEl.addEventListener("drop", (e) => {
		e.preventDefault();
		e.stopPropagation();
		draggableEl.classList.remove("trail-drag-over");

		const sourceIndexStr = e.dataTransfer?.getData(DRAG_DATA_TYPE);
		if (sourceIndexStr === undefined || sourceIndexStr === "") {
			return;
		}

		const sourceIndex = parseInt(sourceIndexStr, 10);
		const targetIndex = index;

		if (sourceIndex === targetIndex || isNaN(sourceIndex)) {
			return;
		}

		// Reorder the array
		const [item] = array.splice(sourceIndex, 1);
		if (item !== undefined) {
			array.splice(targetIndex, 0, item);
			onReorder();
		}
	});
}
