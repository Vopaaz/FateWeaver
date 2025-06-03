import { MastermindActionId, ProtagonistActionId } from "../constants/actions";
import { Target } from "./computeWorker";

export class ComputeEngine {
  async compute(args: {
    mastermindPlacement: Record<MastermindActionId, Target[]>;
    protagonistPlacement: Record<ProtagonistActionId, Target[]>;
  }): Promise<number> {
    // 在此调用真实的“效用值”计算逻辑
    return 0;
  }
}