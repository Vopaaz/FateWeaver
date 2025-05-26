import React, { Component } from 'react';
import { connect } from 'react-redux';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { RootState, AppDispatch } from '../store/store';
import { addCharacter, removeCharacter, moveCharacter } from '../store/boardSlice';
import { ALL_CHARACTERS, ALL_LOCATIONS, CHARACTERS_I18N, LOCATIONS_I18N } from '../constants';
import { CharacterId, LocationId } from '../constants';
// Pinyin conversion
import TinyPinyin from 'tiny-pinyin';

interface Props {
  locations: Record<LocationId, CharacterId[]>;
  addCharacter: (payload: { locationId: LocationId; characterId: CharacterId }) => void;
  removeCharacter: (payload: { locationId: LocationId; characterId: CharacterId }) => void;
  moveCharacter: (payload: {
    sourceLocationId: LocationId;
    destinationLocationId: LocationId;
    sourceIndex: number;
    destinationIndex: number;
  }) => void;
}

interface State {
  searchQuery: Partial<Record<LocationId, string>>;
}

class CurrentBoard extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { searchQuery: {} }; // track per-location search
  }

  onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    this.props.moveCharacter({
      sourceLocationId: source.droppableId as LocationId,
      destinationLocationId: destination.droppableId as LocationId,
      sourceIndex: source.index,
      destinationIndex: destination.index,
    });
  };

  handleSearch = (locationId: LocationId, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    this.setState((prev) => ({
      searchQuery: { ...prev.searchQuery, [locationId]: value },
    }));
  };

  handleAdd = (locationId: LocationId, e: React.ChangeEvent<HTMLSelectElement>) => {
    const characterId = e.target.value as CharacterId;
    if (characterId) {
      this.props.addCharacter({ locationId, characterId });
      e.target.value = '';
      // clear search after select
      this.setState((prev) => ({
        searchQuery: { ...prev.searchQuery, [locationId]: '' },
      }));
    }
  };

  render() {
    const { locations } = this.props;
    const selected = new Set<CharacterId>();
    ALL_LOCATIONS.forEach((loc) =>
      locations[loc].forEach((char) => selected.add(char))
    );

    return (
      <div className="container py-4">
        <h2 className="mb-4 text-center">当前局面</h2>
        <DragDropContext onDragEnd={this.onDragEnd}>
          <div className="row row-cols-1 row-cols-md-2 g-4">
            {ALL_LOCATIONS.map((locationId) => {
              const query = this.state.searchQuery[locationId] ?? '';
              const lowerQuery = query.toLowerCase();
              const options = ALL_CHARACTERS.filter(
                (c) => {
                  if (selected.has(c)) return false;
                  const name = CHARACTERS_I18N[c];
                  const pinyin = TinyPinyin.convertToPinyin(name, '', true).toLowerCase();
                  return name.toLowerCase().includes(lowerQuery) ||
                         c.toLowerCase().includes(lowerQuery) ||
                         pinyin.includes(lowerQuery);
                }
              );

              return (
                <div key={locationId} className="col">
                  <div className="card h-100 shadow-sm">
                    <div className="card-header bg-light fs-5">
                      {LOCATIONS_I18N[locationId]}
                    </div>
                    <div className="card-body">
                      <div className="mb-2">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="搜索角色"
                          value={query}
                          onChange={(e) => this.handleSearch(locationId, e)}
                        />
                      </div>
                      <div className="mb-3">
                        <select
                          className="form-select"
                          onChange={(e) => this.handleAdd(locationId, e)}
                          defaultValue=""
                        >
                          <option value="" disabled>
                            添加角色
                          </option>
                          {options.map((c) => (
                            <option key={c} value={c}>
                              {CHARACTERS_I18N[c]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Droppable droppableId={locationId}>
                        {(provided) => (
                          <ul
                            className="list-group list-group-flush"
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                          >
                            {locations[locationId].map((characterId, index) => (
                              <Draggable
                                key={characterId}
                                draggableId={characterId}
                                index={index}
                              >
                                {(prov) => (
                                  <li
                                    className="list-group-item d-flex justify-content-between align-items-center"
                                    ref={prov.innerRef}
                                    {...prov.draggableProps}
                                    {...prov.dragHandleProps}
                                  >
                                    <span>{CHARACTERS_I18N[characterId]}</span>
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() =>
                                        this.props.removeCharacter({ locationId, characterId })
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
              );
            })}
          </div>
        </DragDropContext>
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  locations: state.board.locations,
});
const mapDispatchToProps = (dispatch: AppDispatch) => ({
  addCharacter: (payload: { locationId: LocationId; characterId: CharacterId }) =>
    dispatch(addCharacter(payload)),
  removeCharacter: (payload: { locationId: LocationId; characterId: CharacterId }) =>
    dispatch(removeCharacter(payload)),
  moveCharacter: (payload: {
    sourceLocationId: LocationId;
    destinationLocationId: LocationId;
    sourceIndex: number;
    destinationIndex: number;
  }) => dispatch(moveCharacter(payload)),
});

export default connect(mapStateToProps, mapDispatchToProps)(CurrentBoard);