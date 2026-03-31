import type { ConnectionConfig } from '../../shared/types';
import { getDefaultSchemaForDbType } from '../store/tabStore';
import type { ResolvedPreviewTarget, TablePreviewRequest } from './table-preview';

interface BuildPreviewUpdatesParams {
  target: ResolvedPreviewTarget;
  request: TablePreviewRequest;
  selectedConnection: ConnectionConfig;
}

export const buildPreviewUpdates = ({
  target,
  request,
  selectedConnection,
}: BuildPreviewUpdatesParams) => ({
  content: target.sql,
  database: request.database ?? selectedConnection.database,
  schema:
    request.schema ??
    getDefaultSchemaForDbType(
      selectedConnection.dbType,
      request.database ?? selectedConnection.database
    ),
  previewTable: target.previewTable,
  pendingPreviewSql: target.sql,
  pendingPreviewRequestId: target.requestId,
});
