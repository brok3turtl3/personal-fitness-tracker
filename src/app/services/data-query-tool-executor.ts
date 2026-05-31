import { Injectable } from '@angular/core';
import { WeightService } from './weight.service';
import { CardioService } from './cardio.service';
import { ReadingsService } from './readings.service';
import { DietService } from './diet.service';
import type { ToolExecutor } from './tool-registry.service';

/** RED stub — implemented in the GREEN phase. */
@Injectable({ providedIn: 'root' })
export class DataQueryToolExecutor {
  readonly executors: ToolExecutor[] = [];

  constructor(
    private weight: WeightService,
    private cardio: CardioService,
    private readings: ReadingsService,
    private diet: DietService
  ) {}
}
