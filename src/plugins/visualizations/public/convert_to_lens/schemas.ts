/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import type { DataView } from '@kbn/data-views-plugin/common';
import { METRIC_TYPES, TimefilterContract } from '@kbn/data-plugin/public';
import { AggBasedColumn, SchemaConfig } from '../../common';
import { convertMetricToColumns } from '../../common/convert_to_lens/lib/metrics';
import { convertBucketToColumns } from '../../common/convert_to_lens/lib/buckets';
import { getCustomBucketsFromSiblingAggs } from '../../common/convert_to_lens/lib/utils';
import type { Vis } from '../types';
import { getVisSchemas, Schemas } from '../vis_schemas';
import {
  getBucketCollapseFn,
  getBucketColumns,
  getColumnIds,
  getColumnsWithoutReferenced,
  getMetricsWithoutDuplicates,
  isValidVis,
  sortColumns,
} from './utils';

const areVisSchemasValid = (visSchemas: Schemas, unsupported: Array<keyof Schemas>) => {
  const usedUnsupportedSchemas = unsupported.filter(
    (schema) => visSchemas[schema] && visSchemas[schema]?.length
  );
  return !usedUnsupportedSchemas.length;
};

export const getColumnsFromVis = <T>(
  vis: Vis<T>,
  timefilter: TimefilterContract,
  dataView: DataView,
  {
    splits = [],
    buckets = [],
    unsupported = [],
  }: {
    splits?: Array<keyof Schemas>;
    buckets?: Array<keyof Schemas>;
    unsupported?: Array<keyof Schemas>;
  } = {},
  config?: {
    dropEmptyRowsInDateHistogram?: boolean;
  }
) => {
  const visSchemas = getVisSchemas(vis, {
    timefilter,
    timeRange: timefilter.getAbsoluteTime(),
  });

  if (!isValidVis(visSchemas) || !areVisSchemasValid(visSchemas, unsupported)) {
    return null;
  }

  const customBuckets = getCustomBucketsFromSiblingAggs(visSchemas.metric);

  // doesn't support sibbling pipeline aggs with different bucket aggs
  if (customBuckets.length > 1) {
    return null;
  }

  const metricsWithoutDuplicates = getMetricsWithoutDuplicates(visSchemas.metric);
  const aggs = metricsWithoutDuplicates as Array<SchemaConfig<METRIC_TYPES>>;

  const metricColumns = metricsWithoutDuplicates.flatMap((m) =>
    convertMetricToColumns(m, dataView, aggs)
  );

  if (metricColumns.includes(null)) {
    return null;
  }
  const metrics = metricColumns as AggBasedColumn[];
  const customBucketColumns = [];

  if (customBuckets.length) {
    const customBucketColumn = convertBucketToColumns(
      { agg: customBuckets[0], dataView, metricColumns: metrics, aggs },
      false,
      config?.dropEmptyRowsInDateHistogram
    );
    if (!customBucketColumn) {
      return null;
    }
    customBucketColumns.push(customBucketColumn);
  }

  const bucketColumns = getBucketColumns(
    visSchemas,
    buckets,
    dataView,
    false,
    metricColumns as AggBasedColumn[],
    config?.dropEmptyRowsInDateHistogram
  );
  if (!bucketColumns) {
    return null;
  }

  const splitBucketColumns = getBucketColumns(
    visSchemas,
    splits,
    dataView,
    true,
    metricColumns as AggBasedColumn[],
    config?.dropEmptyRowsInDateHistogram
  );
  if (!splitBucketColumns) {
    return null;
  }

  const columns = sortColumns(
    [...metrics, ...bucketColumns, ...splitBucketColumns, ...customBucketColumns],
    visSchemas,
    [...buckets, ...splits],
    metricsWithoutDuplicates
  );

  const columnsWithoutReferenced = getColumnsWithoutReferenced(columns);

  return {
    metrics: getColumnIds(columnsWithoutReferenced.filter((с) => !с.isBucketed)),
    buckets: getColumnIds(columnsWithoutReferenced.filter((c) => c.isBucketed)),
    bucketCollapseFn: getBucketCollapseFn(visSchemas.metric, customBucketColumns),
    columnsWithoutReferenced,
    columns,
  };
};
