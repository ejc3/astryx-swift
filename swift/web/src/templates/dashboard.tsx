// Astryx's `dashboard` template, refactored onto the core: the JSX of
// src/stock/templates/dashboard.tsx, drawing `view` (core/src/templates/dashboard/model.ts) and sending
// actions with `send`. It must look pixel-for-pixel like the stock copy (npm run parity).
// Transient on the web side only: the chart tooltip's hover (recharts owns it).
'use client';

import {VStack, HStack, Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
import {Button} from '@astryxdesign/core/Button';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {Grid} from '@astryxdesign/core/Grid';
import {Table, proportional, pixel} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Divider} from '@astryxdesign/core/Divider';
import {Link} from '@astryxdesign/core/Link';
import {Icon} from '@astryxdesign/core/Icon';

import type {
  DashboardView as View,
  DataColor,
  EventsTable,
  PagesTable,
} from '../../../core/src/templates/dashboard/model.ts';
import type {TemplateProps} from './props.ts';

// ============= ICONS =============

import {
  ArrowPathIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import {StopIcon} from '@heroicons/react/24/solid';

// ============= DATA =============

// The view names a data color; the page maps it to the Astryx token.
const dataColors: Record<DataColor, string> = {
  blue: 'var(--color-data-categorical-blue, #0171E3)',
  orange: 'var(--color-data-categorical-orange, #EB6E00)',
  green: 'var(--color-data-categorical-green, #0B991F)',
  purple: 'var(--color-data-categorical-purple, #6B1EFD)',
  neutral: 'var(--color-data-neutral, #8494A3)',
};

type ActiveUsers = View['activeUsers'];

interface PageRow extends Record<string, unknown> {
  id: string;
  page: string;
  views: number;
  max: number;
  barLabel: string;
  viewsLabel: string;
  newUsers: string;
  avgTime: string;
}

function topPagesColumns(headers: PagesTable['headers']): TableColumn<PageRow>[] {
  return [
    {key: 'page', header: headers.page, width: pixel(160)},
    {
      key: 'views',
      header: headers.views,
      width: proportional(1),
      renderCell: (item: PageRow) => (
        <VStack gap={1}>
          <ProgressBar
            value={item.views}
            max={item.max}
            label={item.barLabel}
            isLabelHidden
          />
          <Text type="supporting">{item.viewsLabel}</Text>
        </VStack>
      ),
    },
    {key: 'newUsers', header: headers.newUsers, width: pixel(120)},
    {key: 'avgTime', header: headers.avgTime, width: pixel(120)},
  ];
}

interface EventRow extends Record<string, unknown> {
  id: string;
  event: string;
  count: number;
  max: number;
  barLabel: string;
  countLabel: string;
  usersLabel: string;
  newUsersLabel: string;
}

function topEventsColumns(headers: EventsTable['headers']): TableColumn<EventRow>[] {
  return [
    {key: 'event', header: headers.event, width: pixel(160)},
    {
      key: 'count',
      header: headers.count,
      width: proportional(1),
      renderCell: (item: EventRow) => (
        <VStack gap={1}>
          <ProgressBar
            value={item.count}
            max={item.max}
            label={item.barLabel}
            isLabelHidden
          />
          <Text type="supporting">{item.countLabel}</Text>
        </VStack>
      ),
    },
    {
      key: 'users',
      header: headers.users,
      width: pixel(120),
      renderCell: (item: EventRow) => item.usersLabel,
    },
    {
      key: 'newUsers',
      header: headers.newUsers,
      width: pixel(120),
      renderCell: (item: EventRow) => item.newUsersLabel,
    },
  ];
}

// ============= CHART COMPONENTS =============

function ChartLegendItem({color, label}: {color: string; label: string}) {
  return (
    <HStack gap={2} vAlign="center">
      <Icon icon={StopIcon} size="xsm" style={{color}} />
      <Text type="supporting" color="secondary">
        {label}
      </Text>
    </HStack>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  points,
}: {
  active?: boolean;
  payload?: Array<{name: string; value: number; color: string}>;
  label?: number;
  points: ActiveUsers['points'];
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const point = points.find(d => d.hour === label);
  return (
    <Card padding={3}>
      <VStack gap={1}>
        <Text type="supporting" color="secondary">
          {point?.label ?? ''}
        </Text>
        {payload.map(entry => (
          <HStack key={entry.name} gap={2} vAlign="center">
            <Icon icon={StopIcon} size="xsm" style={{color: entry.color}} />
            <Text type="supporting">
              {entry.name}: {entry.value}
            </Text>
          </HStack>
        ))}
      </VStack>
    </Card>
  );
}

function ActiveUsersChart({chart}: {chart: ActiveUsers}) {
  const xAxisTicks = chart.xTicks.map(t => t.at);
  const xAxisLabels: Record<number, string> = Object.fromEntries(
    chart.xTicks.map(t => [t.at, t.label]),
  );
  return (
    <VStack gap={3}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chart.points}
          margin={{top: 5, right: 10, left: 0, bottom: 5}}>
          <CartesianGrid
            horizontal
            vertical={false}
            stroke="var(--color-border, rgba(5, 54, 89, 0.1))"
          />
          <XAxis
            dataKey="hour"
            type="number"
            domain={chart.xDomain}
            ticks={xAxisTicks}
            tickFormatter={(v: number) => xAxisLabels[v] ?? ''}
            tick={{
              fontSize: 'var(--font-size-sm, 12px)',
              fill: 'var(--color-text-secondary, #4E606F)',
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={chart.yDomain}
            ticks={chart.yTicks}
            tick={{
              fontSize: 'var(--font-size-sm, 12px)',
              fill: 'var(--color-text-secondary, #4E606F)',
            }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            content={<ChartTooltip points={chart.points} />}
            cursor={{stroke: 'var(--color-border, rgba(5, 54, 89, 0.1))'}}
          />
          {chart.series.map(s => (
            <Line
              key={s.key}
              type="linear"
              dataKey={s.key}
              name={s.name}
              stroke={dataColors[s.color]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <HStack gap={6} vAlign="center">
        {chart.series.map(s => (
          <ChartLegendItem
            key={s.key}
            color={dataColors[s.color]}
            label={s.name}
          />
        ))}
      </HStack>
    </VStack>
  );
}

function Sparkline({data}: {data: number[]}) {
  const chartData = data.map((v, i) => ({i, v}));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={chartData}>
        <Line
          type="linear"
          dataKey="v"
          stroke="var(--color-data-categorical-blue, #0171E3)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ============= CARD COMPONENTS =============

function MetricCard({
  label,
  value,
  change,
  positive,
  caption,
  sparkline,
}: View['metrics'][number]) {
  return (
    <Card>
      <VStack gap={2}>
        <Heading level={4}>{label}</Heading>
        <HStack gap={2} vAlign="center">
          <Heading level={2}>{value}</Heading>
          <HStack gap={1} vAlign="center">
            {positive ? (
              <Icon icon={ArrowUpIcon} size="xsm" color="success" />
            ) : (
              <Icon icon={ArrowDownIcon} size="xsm" color="error" />
            )}
            <Text type="body" color="secondary">
              {change}
            </Text>
          </HStack>
        </HStack>
        <Text type="supporting" color="secondary">
          {caption}
        </Text>
        <Sparkline data={sparkline} />
      </VStack>
    </Card>
  );
}

function StackedBarCard({
  title,
  data,
}: {
  title: string;
  data: View['demographics']['cards'][number]['segments'];
}) {
  // Recharts needs a single data row with each segment as a separate key
  const chartData = [Object.fromEntries(data.map(d => [d.label, d.value]))];

  return (
    <Card>
      <VStack gap={4}>
        <Heading level={4}>{title}</Heading>
        <ResponsiveContainer width="100%" height={24}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{top: 0, right: 0, bottom: 0, left: 0}}
            barCategoryGap={0}>
            <XAxis type="number" hide />
            <YAxis type="category" hide />
            {data.map((d, i) => (
              <Bar
                key={d.label}
                dataKey={d.label}
                stackId="stack"
                fill={dataColors[d.color]}
                isAnimationActive={false}
                radius={
                  i === 0
                    ? [4, 0, 0, 4]
                    : i === data.length - 1
                      ? [0, 4, 4, 0]
                      : [0, 0, 0, 0]
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        {/* Legend */}
        <HStack gap={4} wrap="wrap">
          {data.map(d => (
            <VStack key={d.label} gap={0}>
              <HStack gap={2} vAlign="center">
                <Icon
                  icon={StopIcon}
                  size="xsm"
                  style={{color: dataColors[d.color]}}
                />
                <Text type="supporting">{d.label}</Text>
              </HStack>
              <Text type="supporting" color="secondary">
                {d.value} - {d.share}%
              </Text>
            </VStack>
          ))}
        </HStack>
      </VStack>
    </Card>
  );
}

// ============= TABLE COMPONENTS =============

function TableCard<T extends {id: string}>({
  title,
  linkLabel,
  linkHref,
  data,
  columns,
}: {
  title: string;
  linkLabel: string;
  linkHref: string;
  data: T[];
  columns: TableColumn<T>[];
}) {
  return (
    <Card>
      <VStack gap={6}>
        <HStack hAlign="between" vAlign="center">
          <Heading level={4}>{title}</Heading>
          <Link href={linkHref}>{linkLabel}</Link>
        </HStack>
        <Table<T>
          data={data}
          columns={columns}
          idKey="id"
          density="compact"
          dividers="rows"
          hasHover
        />
      </VStack>
    </Card>
  );
}

// ============= MAIN COMPONENT =============

export default function DashboardTemplate({view: raw, send}: TemplateProps) {
  const view = raw as View;
  const {activeUsers, demographics, engagement} = view;
  return (
    <Layout
      height="fill"
      content={
        <LayoutContent padding={6}>
          <VStack gap={6}>
            {/* Active Users Chart */}
            <VStack gap={6}>
              <HStack hAlign="between" vAlign="center">
                <Heading level={3}>{activeUsers.title}</Heading>
                <Button
                  label={activeUsers.reloadLabel}
                  variant="secondary"
                  size="md"
                  icon={<Icon icon={ArrowPathIcon} size="sm" />}
                  onClick={() => send({type: 'press', id: 'tpl.dashboard.reload'})}
                />
              </HStack>
              <ActiveUsersChart chart={activeUsers} />
            </VStack>

            {/* Metric Cards */}
            <Grid columns={{minWidth: 320, repeat: 'fit'}} gap={4}>
              {[0, 2].map(start => (
                <Grid
                  key={start}
                  columns={{minWidth: 240, repeat: 'fit'}}
                  gap={4}>
                  {view.metrics.slice(start, start + 2).map(m => (
                    <MetricCard key={m.label} {...m} />
                  ))}
                </Grid>
              ))}
            </Grid>

            <Divider />

            {/* Demographics */}
            <HStack hAlign="between" vAlign="center">
              <Heading level={3}>{demographics.title}</Heading>
              <Button label={demographics.moreLabel} variant="secondary" size="md" />
            </HStack>
            <Grid columns={{minWidth: 320, repeat: 'fit'}} gap={4}>
              {demographics.cards.map(c => (
                <StackedBarCard key={c.title} title={c.title} data={c.segments} />
              ))}
            </Grid>

            <Divider />

            {/* Engagement */}
            <HStack hAlign="between" vAlign="center">
              <Heading level={3}>{engagement.title}</Heading>
              <Button label={engagement.moreLabel} variant="secondary" size="md" />
            </HStack>
            <Grid columns={{minWidth: 320, repeat: 'fit'}} gap={4}>
              <TableCard
                title={engagement.pages.title}
                linkLabel={engagement.pages.linkLabel}
                linkHref={engagement.pages.linkHref}
                data={engagement.pages.rows as PageRow[]}
                columns={topPagesColumns(engagement.pages.headers)}
              />
              <TableCard
                title={engagement.events.title}
                linkLabel={engagement.events.linkLabel}
                linkHref={engagement.events.linkHref}
                data={engagement.events.rows as EventRow[]}
                columns={topEventsColumns(engagement.events.headers)}
              />
            </Grid>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
