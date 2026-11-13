import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { environment } from '../../../environments/environment';
import { Attendee, TransportLeg } from '../../services/models';

interface ImportResult {
  errors: string[];
  rows: (Attendee & { action: 'create' | 'update' | 'skip' })[];
  created: number;
  updated: number;
  skipped: number;
  imported: boolean;
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './import.page.html',
  styleUrl: './import.page.css'
})
export class ImportPage {
  overwriteExisting = true;
  fileName = '';
  csv = '';
  busy = false;
  committing = false;
  result: ImportResult | null = null;
  error = '';
  message = '';
  page = 0;
  readonly pageSize = 25;
  private readonly call = httpsCallable<{eventId: string; csv: string; preview: boolean; overwriteExisting: boolean}, ImportResult>(
    functions, 'importAttendees', { timeout: 120000 }
  );

  get visibleRows() { return this.result?.rows.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize) || []; }
  get pageCount() { return Math.ceil((this.result?.rows.length || 0) / this.pageSize); }

  transportFields(leg: TransportLeg): {label: string; value: string}[] {
    const labels: Record<keyof TransportLeg, string> = {
      route: 'Route', point: 'Pickup point', time: 'Time', region: 'Region',
      vehicle: 'Vehicle', driverName: 'Driver', driverPhone: 'Driver phone', coordinator: 'Coordinator'
    };
    return (Object.keys(labels) as (keyof TransportLeg)[])
      .filter(key => !!leg[key]).map(key => ({ label: labels[key], value: leg[key]! }));
  }

  async selectFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.result = null; this.csv = ''; this.error = ''; this.message = ''; this.page = 0;
    this.fileName = file?.name || '';
    if (!file) return;
    if (!/\.csv$/i.test(file.name) || file.size > 1024 * 1024) {
      this.error = 'Choose a CSV file no larger than 1 MB.';
      return;
    }
    this.busy = true;
    try {
      this.csv = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      this.result = (await this.call({ eventId: environment.eventId, csv: this.csv, preview: true, overwriteExisting: this.overwriteExisting })).data;
    } catch (error) { this.error = this.errorMessage(error); }
    finally { this.busy = false; }
  }

  async changeOverwrite(event: Event) {
    this.overwriteExisting = (event.target as HTMLInputElement).checked;
    this.result = null; this.error = ''; this.message = ''; this.page = 0;
    if (!this.csv) return;
    this.busy = true;
    try {
      this.result = (await this.call({ eventId: environment.eventId, csv: this.csv, preview: true, overwriteExisting: this.overwriteExisting })).data;
    } catch (error) { this.error = this.errorMessage(error); }
    finally { this.busy = false; }
  }

  async importRows() {
    if (this.busy || !this.result?.rows.length || this.result.errors.length || this.result.imported || this.result.created + this.result.updated === 0) return;
    this.busy = true; this.committing = true; this.error = ''; this.message = '';
    try {
      const result = (await this.call({ eventId: environment.eventId, csv: this.csv, preview: false, overwriteExisting: this.overwriteExisting })).data;
      if (result.imported) {
        this.message = `Import complete: ${result.created} employees created and ${result.updated} updated, ${result.skipped} skipped. Existing attendance was preserved.`;
        this.result = result;
        this.csv = '';
      } else {
        this.result = result;
      }
    } catch (error) {
      this.error = `${this.errorMessage(error)} If the connection was interrupted, validate the file again to check the current records before retrying.`;
      this.result = null;
    } finally { this.busy = false; this.committing = false; }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unable to process the CSV. Please try again.';
  }
}
