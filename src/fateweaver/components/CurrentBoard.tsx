import React, { Component, ReactNode } from 'react';
import { connect } from 'react-redux';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { RootState, AppDispatch } from '../store/store';
import {
  addCharacter,
  removeCharacter,
  moveCharacter,
  setCharacterStat,
  setLocationIntrigue,
  CharacterStats,
} from '../store/boardSlice';
import {
  ALL_CHARACTERS,
  ALL_LOCATIONS,
  CHARACTERS_I18N,
  LOCATIONS_I18N,
  CharacterId,
  LocationId,
} from '../constants/board';
import TinyPinyin from 'tiny-pinyin';

export type StatKey = keyof CharacterStats;

interface Props {
  locations: Record<LocationId, { characters: CharacterId[]; intrigue: number }>;
  characterStats: Record<CharacterId, CharacterStats>;
  addCharacter: (args: { locationId: LocationId; characterId: CharacterId }) => void;
  removeCharacter: (args: { locationId: LocationId; characterId: CharacterId }) => void;
  moveCharacter: (args: {
    sourceLocationId: LocationId;
    destinationLocationId: LocationId;
    sourceIndex: number;
    destinationIndex: number;
  }) => void;
  setCharacterStat: (args: { characterId: CharacterId; stat: StatKey; value: number }) => void;
  setLocationIntrigue: (args: { locationId: LocationId; value: number }) => void;
}

interface State {
  searchQuery: Partial<Record<LocationId, string>>;
}

class CurrentBoard extends Component<Props, State> {
  state: State = { searchQuery: {} };

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
    this.setState({ searchQuery: { ...this.state.searchQuery, [locationId]: e.target.value } });
  };

  handleAdd = (locationId: LocationId, e: React.ChangeEvent<HTMLSelectElement>) => {
    const characterId = e.target.value as CharacterId;
    if (characterId) {
      this.props.addCharacter({ locationId, characterId });
      e.target.value = '';
      this.setState({ searchQuery: { ...this.state.searchQuery, [locationId]: '' } });
    }
  };

  filterOptions(locationId: LocationId): CharacterId[] {
    const selected = new Set<CharacterId>();
    ALL_LOCATIONS.forEach(loc =>
      this.props.locations[loc].characters.forEach(c => selected.add(c))
    );
    const query = (this.state.searchQuery[locationId] ?? '').toLowerCase();
    return ALL_CHARACTERS.filter(c => {
      if (selected.has(c)) return false;
      const name = CHARACTERS_I18N[c];
      const py = TinyPinyin.convertToPinyin(name, '', true).toLowerCase();
      return (
        name.toLowerCase().includes(query) ||
        c.toLowerCase().includes(query) ||
        py.includes(query)
      );
    });
  }

  renderLocationHeader(locationId: LocationId, intrigue: number): ReactNode {
    return (
      <div className="card-header bg-light d-flex justify-content-between align-items-center">
        <span className="fs-5 text-nowrap">{LOCATIONS_I18N[locationId]}</span>
        <div className="d-flex align-items-center text-nowrap">
          <label className="me-1 mb-0">密谋</label>
          <input
            type="number"
            min={0}
            className="form-control form-control-sm text-center"
            style={{ width: '4rem' }}
            value={intrigue}
            onChange={e => this.props.setLocationIntrigue({ locationId, value: Number(e.target.value) })}
          />
        </div>
      </div>
    );
  }

  renderControls(locationId: LocationId): ReactNode {
    const options = this.filterOptions(locationId);
    const query = this.state.searchQuery[locationId] ?? '';

    return (
      <>
        <input
          type="text"
          className="form-control mb-3"
          placeholder="搜索角色"
          value={query}
          onChange={e => this.handleSearch(locationId, e)}
        />
        <select
          className="form-select mb-3 text-nowrap"
          value=""
          onChange={e => this.handleAdd(locationId, e)}
        >
          <option value="" disabled>添加角色</option>
          {options.map(c => (
            <option key={c} value={c}>{CHARACTERS_I18N[c]}</option>
          ))}
        </select>
      </>
    );
  }

  renderCharacterTable(locationId: LocationId): ReactNode {
    const { characters } = this.props.locations[locationId];
    return (
      <Droppable droppableId={locationId}>
        {prov => (
          <table
            className="table table-sm mb-0"
            style={{ tableLayout: 'auto' }}
            ref={prov.innerRef}
            {...prov.droppableProps}
          >
            <thead>
              <tr className="text-center">
                <th className="text-nowrap">角色</th>
                <th className="text-nowrap">不安</th>
                <th className="text-nowrap">友好</th>
                <th className="text-nowrap">密谋</th>
                <th className="text-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {characters.map((characterId, idx) => {
                const stats = this.props.characterStats[characterId];
                return (
                  <Draggable key={characterId} draggableId={characterId} index={idx}>
                    {p => (
                      <tr ref={p.innerRef} {...p.draggableProps}>
                        <td {...p.dragHandleProps} className="text-nowrap">{CHARACTERS_I18N[characterId]}</td>
                        {(['paranoia','goodwill','intrigue'] as StatKey[]).map(stat => (
                          <td key={stat} className="text-nowrap p-1 text-center">
                            <input
                              type="number"
                              min={0}
                              className="form-control form-control-sm text-center"
                              value={stats[stat]}
                              onChange={e => this.props.setCharacterStat({ characterId, stat, value: Number(e.target.value) })}
                            />
                          </td>
                        ))}
                        <td className="text-nowrap p-1 text-center">
                          <button className="btn btn-sm btn-outline-danger" onClick={() => this.props.removeCharacter({ locationId, characterId })}>删除</button>
                        </td>
                      </tr>
                    )}
                  </Draggable>
                );
              })}
              {prov.placeholder}
            </tbody>
          </table>
        )}
      </Droppable>
    );
  }

  render() {
    return (
      <div className="container py-4">
        <h2 className="mb-4 text-center">当前局面（暂无禁入区域验证，请保证输入正确）</h2>
        <DragDropContext onDragEnd={this.onDragEnd}>
          <div className="row row-cols-1 row-cols-md-2 g-4">
            {ALL_LOCATIONS.map(locationId => {
              const loc = this.props.locations[locationId];
              return (
                <div key={locationId} className="col">
                  <div className="card h-100 shadow-sm">
                    {this.renderLocationHeader(locationId, loc.intrigue)}
                    <div className="card-body">
                      {this.renderControls(locationId)}
                      {this.renderCharacterTable(locationId)}
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
  characterStats: state.board.characterStats,
});
const mapDispatchToProps = (dispatch: AppDispatch) => ({
  addCharacter: (args: { locationId: LocationId; characterId: CharacterId }) => dispatch(addCharacter(args)),
  removeCharacter: (args: { locationId: LocationId; characterId: CharacterId }) => dispatch(removeCharacter(args)),
  moveCharacter: (args: { sourceLocationId: LocationId; destinationLocationId: LocationId; sourceIndex: number; destinationIndex: number }) => dispatch(moveCharacter(args)),
  setCharacterStat: (args: { characterId: CharacterId; stat: StatKey; value: number }) => dispatch(setCharacterStat(args)),
  setLocationIntrigue: (args: { locationId: LocationId; value: number }) => dispatch(setLocationIntrigue(args)),
});

export default connect(mapStateToProps, mapDispatchToProps)(CurrentBoard);