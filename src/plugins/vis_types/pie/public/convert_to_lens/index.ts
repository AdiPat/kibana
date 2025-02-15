/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { Column, ColumnWithMeta } from '@kbn/visualizations-plugin/common';
import {
  convertToLensModule,
  getDataViewByIndexPatternId,
} from '@kbn/visualizations-plugin/public';
import uuid from 'uuid';
import { getDataViewsStart } from '../services';
import { getConfiguration } from './configurations';
import { ConvertPieToLensVisualization } from './types';

export const isColumnWithMeta = (column: Column): column is ColumnWithMeta => {
  if ((column as ColumnWithMeta).meta) {
    return true;
  }
  return false;
};

export const excludeMetaFromColumn = (column: Column) => {
  if (isColumnWithMeta(column)) {
    const { meta, ...rest } = column;
    return rest;
  }
  return column;
};

export const convertToLens: ConvertPieToLensVisualization = async (vis, timefilter) => {
  if (!timefilter) {
    return null;
  }

  const dataViews = getDataViewsStart();
  const dataView = await getDataViewByIndexPatternId(vis.data.indexPattern?.id, dataViews);

  if (!dataView) {
    return null;
  }

  const { getColumnsFromVis } = await convertToLensModule;
  const result = getColumnsFromVis(vis, timefilter, dataView, {
    buckets: [],
    splits: ['segment'],
    unsupported: ['split_row', 'split_column'],
  });

  if (result === null) {
    return null;
  }

  // doesn't support more than three split slice levels
  // doesn't support pie without at least one split slice
  if (result.buckets.length > 3 || !result.buckets.length) {
    return null;
  }

  const layerId = uuid();

  const indexPatternId = dataView.id!;
  return {
    type: 'lnsPie',
    layers: [
      {
        indexPatternId,
        layerId,
        columns: result.columns.map(excludeMetaFromColumn),
        columnOrder: [],
      },
    ],
    configuration: getConfiguration(layerId, vis, result),
    indexPatternIds: [indexPatternId],
  };
};
