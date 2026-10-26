import React, { memo } from 'react';
import type { Wall } from '../../../../models/architecture/Wall';
import type {
  WallElevation,
  ElevationFace,
  ElevationBox,
  ElevationOpening,
  ElevationConduit,
  OpeningElevationPatch
} from '../../../../models/architecture/wallElevation';
import type { Conduit, ConduitMaterial, ConduitRoutePreset } from '../../../../models/electrical/ElectricalModel';
import type { ConduitLengthBreakdown } from '../../../../models/electrical/conduitMetrics';
import type { ConduitPresetOption } from '../../../../models/architecture/conduitElevationRoute';
import type {
  BoxTypeDefinition,
  CabinetSizePreset,
  HeightPresetOption
} from '../../../../models/electrical/electricalStandards';
import type { OpeningTypeDefinition } from '../../../../models/architecture/openingPresets';
import { ElevationBoxInspector } from './ElevationBoxInspector';
import { ElevationOpeningInspector } from './ElevationOpeningInspector';
import { ElevationConduitInspector } from './ElevationConduitInspector';
import { ElevationWallInfoPanel } from './ElevationWallInfoPanel';

interface ElevationInspectorSidebarProps {
  wall: Wall;
  elevation: WallElevation;
  face: ElevationFace | null;
  selectedBox: ElevationBox | null;
  selectedOpening: ElevationOpening | null;
  selectedConduit: ElevationConduit | null;
  rawSelectedConduit: Conduit | null;
  selectedConduitMetric: ConduitLengthBreakdown | null;
  conduitPresetOptions: readonly ConduitPresetOption[];
  boxTypes: BoxTypeDefinition[];
  cabinetSizePresets: readonly CabinetSizePreset[];
  heightPresets: readonly HeightPresetOption[];
  openingTypes: readonly OpeningTypeDefinition[];
  onClearSelection: () => void;
  onToggleFace: () => void;
  onStartConduitConnection: (boxId: string) => void;
  onOpenExternalModal: () => void;
  onDeleteSelectedBox: () => void;
  onRotateSelectedBox: () => void;
  onSetBoxOrientation: (orientation: 'vertical' | 'horizontal') => void;
  onSetElementBoxType: (boxId: string, boxTypeId: string) => void;
  onSetPanelDimensions: (
    panelId: string,
    dimensions: { widthMM?: number; heightMM?: number; depthMM?: number; dinModules?: number }
  ) => void;
  onSetSelectedBoxX: (x: number) => void;
  onSetSelectedBoxZ: (z: number) => void;
  onNudgeSelectedBox: (dx: number, dz: number) => void;
  onApplyOpeningPreset: (presetId: string) => void;
  onPatchSelectedOpening: (patch: OpeningElevationPatch) => void;
  onDeleteSelectedOpening: () => void;
  formatConduitSize: (mat?: ConduitMaterial, diam?: number) => string;
  onSetConduitPreset: (conduitId: string, preset: ConduitRoutePreset) => void;
  onResetConduitRoute: (conduitId: string) => void;
  onNudgeSelectedConduitHeight: (deltaM: number) => void;
  onSetSelectedConduitHeight: (z: number) => void;
  onOpenConduitModal: () => void;
  onDeleteConduit: (conduitId: string) => void;
}

export const ElevationInspectorSidebar: React.FC<ElevationInspectorSidebarProps> = memo(({
  wall,
  elevation,
  face,
  selectedBox,
  selectedOpening,
  selectedConduit,
  rawSelectedConduit,
  selectedConduitMetric,
  conduitPresetOptions,
  boxTypes,
  cabinetSizePresets,
  heightPresets,
  openingTypes,
  onClearSelection,
  onToggleFace,
  onStartConduitConnection,
  onOpenExternalModal,
  onDeleteSelectedBox,
  onRotateSelectedBox,
  onSetBoxOrientation,
  onSetElementBoxType,
  onSetPanelDimensions,
  onSetSelectedBoxX,
  onSetSelectedBoxZ,
  onNudgeSelectedBox,
  onApplyOpeningPreset,
  onPatchSelectedOpening,
  onDeleteSelectedOpening,
  formatConduitSize,
  onSetConduitPreset,
  onResetConduitRoute,
  onNudgeSelectedConduitHeight,
  onSetSelectedConduitHeight,
  onOpenConduitModal,
  onDeleteConduit
}) => {
  return (
    <aside className="hidden lg:block w-80 bg-slate-900 border-l border-slate-800 p-4 space-y-4 overflow-y-auto text-slate-200 shrink-0">
      {selectedBox ? (
        <ElevationBoxInspector
          selectedBox={selectedBox}
          elevation={elevation}
          boxTypes={boxTypes}
          cabinetSizePresets={cabinetSizePresets}
          heightPresets={heightPresets}
          onClearSelection={onClearSelection}
          onStartConduitConnection={onStartConduitConnection}
          onOpenExternalModal={onOpenExternalModal}
          onDeleteSelectedBox={onDeleteSelectedBox}
          onRotateSelectedBox={onRotateSelectedBox}
          onSetBoxOrientation={onSetBoxOrientation}
          onSetElementBoxType={onSetElementBoxType}
          onSetPanelDimensions={onSetPanelDimensions}
          onSetSelectedBoxX={onSetSelectedBoxX}
          onSetSelectedBoxZ={onSetSelectedBoxZ}
          onNudgeSelectedBox={onNudgeSelectedBox}
        />
      ) : selectedOpening ? (
        <ElevationOpeningInspector
          selectedOpening={selectedOpening}
          openingTypes={openingTypes}
          onClearSelection={onClearSelection}
          onApplyOpeningPreset={onApplyOpeningPreset}
          onPatchSelectedOpening={onPatchSelectedOpening}
          onDeleteSelectedOpening={onDeleteSelectedOpening}
        />
      ) : selectedConduit ? (
        <ElevationConduitInspector
          selectedConduit={selectedConduit}
          rawSelectedConduit={rawSelectedConduit}
          selectedConduitMetric={selectedConduitMetric}
          conduitPresetOptions={conduitPresetOptions}
          ceilingZ={elevation.ceilingZ}
          onClearSelection={onClearSelection}
          formatConduitSize={formatConduitSize}
          onSetConduitPreset={onSetConduitPreset}
          onResetConduitRoute={onResetConduitRoute}
          onNudgeSelectedConduitHeight={onNudgeSelectedConduitHeight}
          onSetSelectedConduitHeight={onSetSelectedConduitHeight}
          onOpenConduitModal={onOpenConduitModal}
          onDeleteConduit={onDeleteConduit}
        />
      ) : (
        <ElevationWallInfoPanel
          wall={wall}
          elevation={elevation}
          face={face}
          onToggleFace={onToggleFace}
        />
      )}
    </aside>
  );
});
