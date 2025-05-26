import React, { Component } from 'react';
import { connect } from 'react-redux';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { RootState, AppDispatch } from '../store/store';
import { addItem, removeItem, moveItem } from '../store/boardSlice';

// Pre-defined constant items
const ALL_ITEMS = ['Item A', 'Item B', 'Item C', 'Item D', 'Item E', 'Item F'];
const BOX_IDS = ['hospital', 'shrine', 'city', 'school'];
const BOX_LABELS: Record<string, string> = {
  hospital: 'Hospital',
  shrine: 'Shrine',
  city: 'City',
  school: 'School',
};

interface Props {
  boxes: Record<string, string[]>;
  addItem: (payload: { boxId: string; itemId: string }) => void;
  removeItem: (payload: { boxId: string; itemId: string }) => void;
  moveItem: (payload: {
    sourceBoxId: string;
    destinationBoxId: string;
    sourceIndex: number;
    destinationIndex: number;
  }) => void;
}

class CurrentBoard extends Component<Props> {
  // Arrow methods autobind `this`
  onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    this.props.moveItem({
      sourceBoxId: source.droppableId,
      destinationBoxId: destination.droppableId,
      sourceIndex: source.index,
      destinationIndex: destination.index,
    });
  };

  handleAdd = (boxId: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    const itemId = e.target.value;
    if (itemId) {
      this.props.addItem({ boxId, itemId });
      e.target.value = '';
    }
  };

  render() {
    const selected = new Set<string>();
    BOX_IDS.forEach((id) =>
      this.props.boxes[id].forEach((item) => selected.add(item))
    );

    return (
      <div className="container py-4">
        <h2 className="mb-4 text-center">当前局面</h2>
        <DragDropContext onDragEnd={this.onDragEnd}>
          <div className="row row-cols-1 row-cols-md-2 g-4">
            {BOX_IDS.map((boxId) => (
              <div key={boxId} className="col">
                <div className="card h-100 shadow-sm">
                  <div className="card-header bg-light fs-5">{BOX_LABELS[boxId]}</div>
                  <div className="card-body">
                    <div className="mb-3">
                      <select
                        className="form-select"
                        onChange={(e) => this.handleAdd(boxId, e)}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          添加项目
                        </option>
                        {ALL_ITEMS.filter((item) => !selected.has(item)).map(
                          (item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <Droppable droppableId={boxId}>
                      {(provided) => (
                        <ul
                          className="list-group list-group-flush"
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                        >
                          {this.props.boxes[boxId].map((item, index) => (
                            <Draggable
                              key={item}
                              draggableId={item}
                              index={index}
                            >
                              {(prov) => (
                                <li
                                  className="list-group-item d-flex justify-content-between align-items-center"
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                  {...prov.dragHandleProps}
                                >
                                  <span>{item}</span>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() =>
                                      this.props.removeItem({ boxId, itemId: item })
                                    }
                                  >
                                    删除
                                  </button>
                                </li>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </ul>
                      )}
                    </Droppable>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  boxes: state.board.boxes,
});
const mapDispatchToProps = (dispatch: AppDispatch) => ({
  addItem: (payload: { boxId: string; itemId: string }) =>
    dispatch(addItem(payload)),
  removeItem: (payload: { boxId: string; itemId: string }) =>
    dispatch(removeItem(payload)),
  moveItem: (payload: {
    sourceBoxId: string;
    destinationBoxId: string;
    sourceIndex: number;
    destinationIndex: number;
  }) => dispatch(moveItem(payload)),
});

export default connect(mapStateToProps, mapDispatchToProps)(CurrentBoard);