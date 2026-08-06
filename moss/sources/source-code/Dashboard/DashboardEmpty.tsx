/**
 * DashboardEmpty - 通用空态
 *
 * 动态读取当前看板名称和必填字段，展示通用引导而非写死的"访前准备"文案。
 */
import React, { useMemo } from 'react';
import { Building2, MapPin, Network, PhoneCall, ShieldCheck, TrendingUp, Truck, UsersRound } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';

const DASHBOARD_EMPTY_COPY = {
  zh: {
    fallbackBoardName: '智能看板',
    genericHint: '请在上方填写查询条件，点击「查询」开始分析',
    enterpriseEyebrow: '输入企业名称后，可查看以下洞察维度',
    enterpriseSubtitleKeywords: ['企业实力', '经营情况', '商业机会'],
    batchQueryEyebrow: '录入企业名单后，可批量生成企业洞察结果',
    batchQueryDimensions: ['粘贴录入', '文件上传', '批量生成'],
    batchQueryUploadFileName: '企业名单',
    batchQueryResultTitle: '批量查询结果',
    biddingEyebrow: '设置查询条件后，可查看招投标相关洞察',
    biddingSubtitleKeywords: ['行业分布', '地区分布', '项目记录'],
    biddingFolderTypes: ['招标', '中标', '拟建'],
    industryChainEyebrow: '输入产业链节点后，可查看上下游关系与节点企业分布',
    industryChainDimensions: ['上游供应', '节点企业', '下游应用'],
    industryChainNodes: [
      { title: '上游节点', description: '生产原材料与生产设备', kind: 'upstream' },
      { title: '中心节点', description: '节点企业与地理位置', kind: 'core' },
      { title: '下游节点', description: '销售渠道与应用领域', kind: 'downstream' },
    ],
    companyFilterEyebrow: '组合筛选条件后，可查看以下画像结果',
    companyFilterDimensions: ['企业名单', '标签分布', '成立年份'],
    companyFilterCriteria: [
      { title: '地域', kind: 'region' },
      { title: '科技资质', kind: 'qualification' },
      { title: '细分行业', kind: 'industry' },
    ],
    companyFilterTargetTitle: '目标企业画像',
    companyFilterTargetTags: ['江苏省', '高新技术企业', '光伏设备制造'],
    enterpriseRiskEyebrow: '输入企业名称后，可查看企业风险扫描结果',
    enterpriseRiskDimensions: ['风险总览', '司法诉讼', '经营风险'],
    enterpriseRiskPanelTitles: ['综合信息', '涉诉趋势', '经营风险'],
    enterpriseRiskScanStatus: 'MOSS 风险识别中',
    enterpriseRiskTags: ['经营异常', '行政处罚', '股权出质', '税务预警', '严重违法'],
    cards: [
      {
        title: '企业概览',
        description: '快速了解企业基础情况',
        tags: ['工商信息', '注册资本', '参保人数'],
      },
      {
        title: '经营动态',
        description: '查看企业经营与市场活动',
        tags: ['融资动态', '招聘动态', '新闻动态'],
      },
      {
        title: '机会跟进',
        description: '快速查询招投标与联系电话',
        tags: ['招投标', '知识产权', '资质政策'],
      },
    ],
  },
  en: {
    fallbackBoardName: 'Smart Dashboard',
    genericHint: 'Fill in the query fields above, then click Search to start analysis',
    enterpriseEyebrow: 'Enter a company name to explore these insight dimensions',
    enterpriseSubtitleKeywords: ['company strength', 'operations', 'business opportunities'],
    batchQueryEyebrow: 'Add company names to generate insight results in batches',
    batchQueryDimensions: ['Paste Input', 'File Upload', 'Batch Generate'],
    batchQueryUploadFileName: 'Company List',
    batchQueryResultTitle: 'Batch Query Results',
    biddingEyebrow: 'Set query conditions to view tender-related insights',
    biddingSubtitleKeywords: ['Industry distribution', 'Regional distribution', 'Project records'],
    biddingFolderTypes: ['Tender', 'Award', 'Planned'],
    industryChainEyebrow: 'Enter an industry node to view upstream, downstream, and company distribution',
    industryChainDimensions: ['Upstream supply', 'Node companies', 'Downstream uses'],
    industryChainNodes: [
      { title: 'Upstream node', description: 'Raw materials and production equipment', kind: 'upstream' },
      { title: 'Core node', description: 'Node companies and locations', kind: 'core' },
      { title: 'Downstream node', description: 'Sales channels and application fields', kind: 'downstream' },
    ],
    companyFilterEyebrow: 'Combine filters to view profile results',
    companyFilterDimensions: ['Company List', 'Tag Distribution', 'Founded Year'],
    companyFilterCriteria: [
      { title: 'Region', kind: 'region' },
      { title: 'Tech Qualification', kind: 'qualification' },
      { title: 'Sub-industry', kind: 'industry' },
    ],
    companyFilterTargetTitle: 'Target Company Profile',
    companyFilterTargetTags: ['Jiangsu', 'High-tech enterprise', 'PV equipment'],
    enterpriseRiskEyebrow: 'Enter a company name to view enterprise risk scan results',
    enterpriseRiskDimensions: ['Risk overview', 'Judicial litigation', 'Operational risk'],
    enterpriseRiskPanelTitles: ['Integrated signals', 'Litigation trends', 'Operational risk'],
    enterpriseRiskScanStatus: 'MOSS identifying risk',
    enterpriseRiskTags: ['Abnormal ops', 'Penalty', 'Equity pledge', 'Tax alert', 'Violation'],
    cards: [
      {
        title: 'Company Overview',
        description: 'Review essential company fundamentals',
        tags: ['Registry', 'Capital', 'Insured staff'],
      },
      {
        title: 'Business Activity',
        description: 'Track operations and market activity',
        tags: ['Financing', 'Hiring', 'News'],
      },
      {
        title: 'Opportunity Follow-up',
        description: 'Quickly find bids and contact numbers',
        tags: ['Bidding', 'IP', 'Licenses'],
      },
    ],
  },
} as const;

type DashboardEmptyLocale = keyof typeof DASHBOARD_EMPTY_COPY;
type DashboardEmptyCopy = (typeof DASHBOARD_EMPTY_COPY)[DashboardEmptyLocale];

const ENTERPRISE_EMPTY_ICON_PROPS = {
  size: 28,
  strokeWidth: 2.2,
} as const;

const ENTERPRISE_EMPTY_PHONE_ICON_PROPS = {
  ...ENTERPRISE_EMPTY_ICON_PROPS,
  size: 26,
} as const;

function resolveDashboardEmptyLocale(): DashboardEmptyLocale {
  if (typeof navigator === 'undefined') return 'zh';
  const language = navigator.language || navigator.languages?.[0] || '';
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function useDashboardEmptyCopy() {
  const [locale, setLocale] = React.useState<DashboardEmptyLocale>(() => resolveDashboardEmptyLocale());

  React.useEffect(() => {
    const next = resolveDashboardEmptyLocale();
    if (next !== locale) setLocale(next);
  }, [locale]);

  return DASHBOARD_EMPTY_COPY[locale];
}

const EmptyIllustration: React.FC = () => (
  <svg width="72" height="64" viewBox="0 0 72 64" fill="none" aria-hidden="true">
    {/* 看板外框 */}
    <rect x="1" y="1" width="70" height="62" rx="10" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
    {/* 顶部标题栏分割线 */}
    <line x1="1" y1="14" x2="71" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.1" />
    {/* 标题栏三个装饰圆点 */}
    <circle cx="12" cy="7.5" r="2" fill="currentColor" opacity="0.18" />
    <circle cx="19" cy="7.5" r="2" fill="currentColor" opacity="0.13" />
    <circle cx="26" cy="7.5" r="2" fill="currentColor" opacity="0.09" />
    {/* 幽灵柱状图 */}
    <rect x="10" y="30" width="9" height="22" rx="3" fill="currentColor" opacity="0.08" />
    <rect x="23" y="22" width="9" height="30" rx="3" fill="currentColor" opacity="0.08" />
    <rect x="36" y="26" width="9" height="26" rx="3" fill="currentColor" opacity="0.08" />
    <rect x="49" y="34" width="9" height="18" rx="3" fill="currentColor" opacity="0.08" />
    {/* 基准线 */}
    <line x1="8" y1="54" x2="62" y2="54" stroke="currentColor" strokeWidth="1" opacity="0.13" />
    {/* 搜索图标 */}
    <circle cx="57" cy="50" r="6.5" stroke="currentColor" strokeWidth="1.5" opacity="0.38" />
    <line x1="61.8" y1="54.8" x2="65.5" y2="58.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.38" />
  </svg>
);

type EnterpriseCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  tags: readonly string[];
  children: React.ReactNode;
  stackIndex: number;
  stackPosition: number;
  isFront: boolean;
};

const EnterpriseEmptyCard: React.FC<EnterpriseCardProps> = ({
  icon,
  title,
  description,
  tags,
  children,
  stackIndex,
  stackPosition,
  isFront,
}) => (
  <section
    className={`dashboard-enterprise-empty-card${isFront ? ' is-front' : ''}`}
    aria-label={title}
    data-stack-index={stackIndex}
    data-stack-position={stackPosition}
  >
    <div className="dashboard-enterprise-empty-card-head">
      <div className="dashboard-enterprise-empty-card-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="dashboard-enterprise-empty-card-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
    <div className="dashboard-enterprise-empty-tags" aria-hidden="true">
      {tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
    {children}
  </section>
);

const CompanyOverviewMock: React.FC = () => (
  <div className="dashboard-enterprise-empty-lines" aria-hidden="true">
    {[0, 1, 2].map((index) => (
      <div className="dashboard-enterprise-empty-line-row" key={index}>
        <span />
        <i />
        <b />
      </div>
    ))}
  </div>
);

const BusinessLensMock: React.FC = () => (
  <div className="dashboard-enterprise-empty-business" aria-hidden="true">
    <div className="dashboard-enterprise-empty-chart">
      {[35, 55, 92, 72, 40, 56, 76].map((height, index) => (
        <i
          key={index}
          className={index === 2 || index === 6 ? 'is-emphasis' : undefined}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  </div>
);

const OpportunityLensMock: React.FC = () => (
  <div className="dashboard-enterprise-empty-opportunity" aria-hidden="true">
    <svg viewBox="0 0 260 60" preserveAspectRatio="none">
      <path className="is-grid" d="M4 8H256M4 28H256M4 48H256" />
      <path className="is-area" d="M4 60L4 49L46 43L88 48L130 30L172 36L214 17L256 24L256 60Z" />
      <path className="is-line" d="M4 49L46 43L88 48L130 30L172 36L214 17L256 24" />
      <circle className="is-point" cx="46" cy="43" r="3.5" />
      <circle className="is-point" cx="130" cy="30" r="3.5" />
      <circle className="is-point" cx="214" cy="17" r="3.5" />
      <circle className="is-point" cx="256" cy="24" r="3.5" />
    </svg>
  </div>
);

const Enterprise360Empty: React.FC<{ copy: DashboardEmptyCopy }> = ({ copy }) => {
  const emptyRef = React.useRef<HTMLDivElement | null>(null);
  const [frontCardIndex, setFrontCardIndex] = React.useState(0);
  const [isCompact, setIsCompact] = React.useState(false);
  const [overview, business, opportunity] = copy.cards;
  const getStackPosition = React.useCallback((index: number) => (index - frontCardIndex + 3) % 3, [frontCardIndex]);

  React.useEffect(() => {
    const emptyNode = emptyRef.current;
    if (!emptyNode || typeof ResizeObserver === 'undefined') return undefined;

    const updateCompactState = (width: number) => setIsCompact(width <= 900);
    updateCompactState(emptyNode.getBoundingClientRect().width);

    const observer = new ResizeObserver(([entry]) => {
      updateCompactState(entry.contentRect.width);
    });
    observer.observe(emptyNode);

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) return undefined;

    const timer = window.setInterval(() => {
      setFrontCardIndex((current) => (current + 1) % 3);
    }, 3000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={`dashboard-empty dashboard-enterprise-empty${isCompact ? ' is-compact' : ''}`} ref={emptyRef}>
      <div className="dashboard-enterprise-empty-intro">
        <div className="dashboard-enterprise-empty-kicker">
          <span />
          <strong>{copy.enterpriseEyebrow}</strong>
          <span />
        </div>
        <p className="dashboard-enterprise-empty-subtitle">
          {copy.enterpriseSubtitleKeywords.map((keyword) => (
            <strong key={keyword}>{keyword}</strong>
          ))}
        </p>
      </div>

      <div className="dashboard-enterprise-empty-cards is-stacked">
        <EnterpriseEmptyCard
          icon={<Building2 {...ENTERPRISE_EMPTY_ICON_PROPS} />}
          title={overview.title}
          description={overview.description}
          tags={overview.tags}
          stackIndex={0}
          stackPosition={getStackPosition(0)}
          isFront={getStackPosition(0) === 0}
        >
          <CompanyOverviewMock />
        </EnterpriseEmptyCard>
        <EnterpriseEmptyCard
          icon={<TrendingUp {...ENTERPRISE_EMPTY_ICON_PROPS} />}
          title={business.title}
          description={business.description}
          tags={business.tags}
          stackIndex={1}
          stackPosition={getStackPosition(1)}
          isFront={getStackPosition(1) === 0}
        >
          <BusinessLensMock />
        </EnterpriseEmptyCard>
        <EnterpriseEmptyCard
          icon={<PhoneCall {...ENTERPRISE_EMPTY_PHONE_ICON_PROPS} />}
          title={opportunity.title}
          description={opportunity.description}
          tags={opportunity.tags}
          stackIndex={2}
          stackPosition={getStackPosition(2)}
          isFront={getStackPosition(2) === 0}
        >
          <OpportunityLensMock />
        </EnterpriseEmptyCard>
      </div>

    </div>
  );
};

const BiddingDrawerFigmaSvg: React.FC<{
  labels: readonly string[];
  frontCardIndex: number;
}> = ({ labels, frontCardIndex }) => {
  const labelRefs = React.useRef<Array<SVGTextElement | null>>([]);
  const [labelWidths, setLabelWidths] = React.useState(() =>
    labels.map((label) => Array.from(label).reduce((width, character) => (
      width + (/[\u2E80-\u9FFF]/u.test(character) ? 14 : 8)
    ), 0)),
  );

  React.useLayoutEffect(() => {
    const measuredWidths = labels.map((label, index) => (
      Math.ceil(labelRefs.current[index]?.getComputedTextLength() || label.length * 14)
    ));
    setLabelWidths((currentWidths) => (
      measuredWidths.some((width, index) => Math.abs(width - currentWidths[index]) > 0.5)
        ? measuredWidths
        : currentWidths
    ));
  }, [labels]);

  const cardGeometry = [
    {
      tabPath: 'M147.776 0.75C159.786 0.750132 170.696 7.74158 175.714 18.6523L222.621 120.652C231.989 141.024 217.106 164.25 194.684 164.25H31.5C14.5172 164.25 0.75 150.483 0.75 133.5V31.5C0.750001 14.5172 14.5172 0.75 31.5 0.75H147.776Z',
      seamPaths: ['M1.5 64.5H195.983L206 87.5L1.5 88.5V64.5Z'],
      labelX: 115,
      iconX: 88,
    },
    {
      tabPath: 'M300.776 0.75C312.786 0.750132 323.696 7.74158 328.714 18.6523L375.621 120.652C384.989 141.024 370.106 164.25 347.684 164.25H184.5C167.517 164.25 153.75 150.483 153.75 133.5V31.5C153.75 14.5172 167.517 0.75 184.5 0.75H300.776Z',
      seamPaths: [
        'M154.5 58.5H345.654L355.5 81.5L154.5 82.5V58.5Z',
        'M348 66.5L350 67L349 65L348 64.5V66.5Z',
      ],
      labelX: 191,
      iconX: 164,
    },
    {
      tabPath: 'M448.776 0.75C460.786 0.750132 471.696 7.74158 476.714 18.6523L523.621 120.652C532.989 141.024 518.106 164.25 495.684 164.25H332.5C315.517 164.25 301.75 150.483 301.75 133.5V31.5C301.75 14.5172 315.517 0.75 332.5 0.75H448.776Z',
      seamPaths: ['M302.5 58.5H493.654L506.5 81.5L302.5 82.5V58.5Z'],
      labelX: 265,
      iconX: 238,
    },
  ] as const;
  const cards = labels.map((label, index) => ({
    index,
    label,
    labelWidth: labelWidths[index] ?? 0,
    geometry: cardGeometry[index] ?? cardGeometry[0],
  }));
  const activeCard = cards[frontCardIndex] ?? cards[0];
  const stackedCards = [
    ...cards.filter((card) => card.index !== activeCard.index).sort((a, b) => b.index - a.index),
    activeCard,
  ];
  const progressLines = [
    { width: 160, y: 68 },
    { width: 106, y: 88 },
    { width: 182, y: 108 },
  ];

  return (
    <svg
      className="dashboard-bidding-figma-drawer"
      width="435"
      height="256"
      viewBox="0 0 435 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g transform="translate(30 22) scale(0.342)">
        <g clipPath="url(#dashboard-bidding-figma-left-wall-clip)">
          <path
            d="M200.711 29.0886L75.6302 58.1772L0 392.695H174.531L200.711 29.0886Z"
            fill="#F4F6F8"
            stroke="#D9DEE9"
            strokeWidth="2.90885"
          />
        </g>
        <g clipPath="url(#dashboard-bidding-figma-right-wall-clip)">
          <path
            d="M916.289 31.9974L1041.37 61.086L1117 395.604H942.469L916.289 31.9974Z"
            fill="#F2F4F7"
            stroke="#DFE5EC"
            strokeWidth="2.90885"
          />
        </g>
        <g filter="url(#dashboard-bidding-figma-box-shadow)">
          <rect x="69.8125" y="31.9974" width="980.284" height="383.969" rx="46.5417" fill="#E7EDF4" />
          <rect
            x="71.2669"
            y="33.4519"
            width="977.375"
            height="381.06"
            rx="45.0872"
            stroke="#CFD5E4"
            strokeWidth="2.90885"
          />
        </g>
      </g>

      <g className="dashboard-bidding-figma-cards">
        {stackedCards.map((card) => {
          const isFront = card.index === activeCard.index;
          const availableLabelWidth = 52;
          const shouldCompressLabel = card.labelWidth > availableLabelWidth;
          const cardFill = isFront ? '#FFFFFF' : '#F6F8FA';
          const cardStroke = isFront ? '#D4DCE8' : '#DDE4ED';
          const cardStrokeOpacity = isFront ? 0.9 : 0.68;
          const cardTransform = isFront
            ? 'translate(71 12) scale(0.496 0.5)'
            : 'translate(73 17) scale(0.48608 0.49)';
          return (
            <g key={card.label}>
              <g
                className={isFront ? 'dashboard-bidding-figma-front-card' : undefined}
                filter={isFront ? 'url(#dashboard-bidding-figma-front-card-shadow)' : undefined}
              >
                <g transform={cardTransform}>
                  <path
                    d={card.geometry.tabPath}
                    fill={cardFill}
                    stroke={cardStroke}
                    strokeWidth="1.5"
                    strokeOpacity={cardStrokeOpacity}
                  />
                  <path
                    d="M31.75 65.75H573.25C590.371 65.75 604.25 79.6292 604.25 96.75V286.5C604.25 293.541 598.541 299.25 591.5 299.25H13.5C6.45937 299.25 0.75 293.541 0.75 286.5V96.75C0.75 79.6292 14.6292 65.75 31.75 65.75Z"
                    fill={cardFill}
                    stroke={cardStroke}
                    strokeWidth="1.5"
                    strokeOpacity={cardStrokeOpacity}
                  />
                  {card.geometry.seamPaths.map((seamPath) => (
                    <path key={seamPath} d={seamPath} fill={cardFill} />
                  ))}
                </g>
              </g>
              {isFront && (
                <path
                  d={`M${card.geometry.iconX + 2} 23H${card.geometry.iconX + 10}V37L${card.geometry.iconX + 6} 34.2L${card.geometry.iconX + 2} 37V23Z`}
                  fill="#E95B3C"
                />
              )}
              <text
                ref={(element) => {
                  labelRefs.current[card.index] = element;
                }}
                className={`dashboard-bidding-figma-label${isFront ? ' is-front' : ' is-muted'}`}
                x={card.geometry.labelX + (isFront ? 5 : 0)}
                y={isFront ? 31 : 32}
                opacity={isFront ? 1 : 0.48}
                textLength={shouldCompressLabel ? availableLabelWidth : undefined}
                lengthAdjust={shouldCompressLabel ? 'spacingAndGlyphs' : undefined}
              >
                {card.label}
              </text>
            </g>
          );
        })}
      </g>

      <g className="dashboard-bidding-figma-active-lines">
        {progressLines.map((line, index) => (
          <g key={line.y}>
            <rect className="dashboard-bidding-figma-line" x="87" y={line.y} width={line.width} height="6" rx="3" />
            {frontCardIndex >= index && (
              <rect
                key={`${frontCardIndex}-${index}`}
                className="dashboard-bidding-figma-line-progress"
                x="87"
                y={line.y}
                width={line.width}
                height="6"
                rx="3"
              />
            )}
          </g>
        ))}
      </g>

      <g transform="translate(8 115) scale(0.282)">
        <g filter="url(#dashboard-bidding-figma-new-front-shadow)">
          <path
            d="M62.4922 89.0546C62.4922 81.1218 67.8728 74.6909 74.5099 74.6909H1414.49C1421.14 74.6909 1426.51 81.1218 1426.51 89.0546V331.8C1426.51 354.012 1411.45 372.018 1392.86 372.018H96.142C77.5578 372.018 62.4922 354.012 62.4922 331.8V89.0546Z"
            fill="#F7F8FC"
          />
          <path
            d="M74.5098 75.1909H1414.49C1420.78 75.1909 1426.01 81.3103 1426.01 89.0542V331.799C1426.01 353.822 1411.09 371.518 1392.86 371.518H96.1416C77.9135 371.518 62.9922 353.822 62.9922 331.799V89.0542C62.9923 81.3106 68.2287 75.191 74.5098 75.1909Z"
            stroke="#D0D6E7"
            strokeOpacity="0.5"
          />
          <path
            d="M74.5097 76.3882H1414.5C1420.35 76.3885 1425.09 82.0592 1425.09 89.0545V331.8C1425.09 353.074 1410.67 370.32 1392.87 370.321H96.1417C78.3418 370.321 63.9121 353.075 63.9121 331.8V89.0545C63.9121 82.0591 68.6568 76.3882 74.5097 76.3882Z"
            stroke="#D0D6E7"
            strokeOpacity="0.5"
            strokeWidth="2.3632"
          />
        </g>
        <g opacity="0.92" filter="url(#dashboard-bidding-figma-new-lip-shadow)">
          <path
            d="M1414.08 74.6768H76.0947C68.5758 74.6768 62.4805 81.9618 62.4805 90.9484C62.4805 99.935 68.5758 107.22 76.0947 107.22H1414.08C1421.6 107.22 1427.7 99.935 1427.7 90.9484C1427.7 81.9618 1421.6 74.6768 1414.08 74.6768Z"
            fill="#FEFEFE"
          />
          <path
            d="M1414.09 76.374H76.0946C69.3599 76.374 63.9004 82.8992 63.9004 90.9484C63.9004 98.9977 69.3599 105.523 76.0946 105.523H1414.09C1420.82 105.523 1426.28 98.9977 1426.28 90.9484C1426.28 82.8992 1420.82 76.374 1414.09 76.374Z"
            stroke="#DBE0EB"
            strokeWidth="2.3632"
          />
        </g>
        <g filter="url(#dashboard-bidding-figma-new-handle-inner)">
          <path
            d="M878.229 185.277H611.692C593.771 185.277 579.244 202.64 579.244 224.058C579.244 245.477 593.771 262.84 611.692 262.84H878.229C896.149 262.84 910.677 245.477 910.677 224.058C910.677 202.64 896.149 185.277 878.229 185.277Z"
            fill="#EDF1F6"
          />
        </g>
        <path
          d="M878.229 186.974H611.692C594.556 186.974 580.664 203.578 580.664 224.059C580.664 244.54 594.556 261.144 611.692 261.144H878.229C895.366 261.144 909.257 244.54 909.257 224.059C909.257 203.578 895.366 186.974 878.229 186.974Z"
          stroke="#CDDBEB"
          strokeWidth="2.3632"
        />
        <path
          d="M851.4 212.567H642.111C636.469 212.567 631.896 218.034 631.896 224.776C631.896 231.519 636.469 236.986 642.111 236.986H851.4C857.042 236.986 861.615 231.519 861.615 224.776C861.615 218.034 857.042 212.567 851.4 212.567Z"
          fill="#F8FAFC"
          stroke="#E4E9F0"
          strokeWidth="2"
        />
      </g>

      <defs>
        <filter
          id="dashboard-bidding-figma-box-shadow"
          x="23.2708"
          y="0"
          width="1073.37"
          height="477.052"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="14.5443" />
          <feGaussianBlur stdDeviation="23.2708" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.145098 0 0 0 0 0.188235 0 0 0 0 0.278431 0 0 0 0.04 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
        <filter
          id="dashboard-bidding-figma-card-stack-shadow"
          x="63"
          y="27"
          width="320"
          height="167"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dx="2" dy="2" />
          <feGaussianBlur stdDeviation="5" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
        <filter
          id="dashboard-bidding-figma-front-card-shadow"
          x="53"
          y="4"
          width="336"
          height="202"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="6" />
          <feGaussianBlur stdDeviation="9" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.890196 0 0 0 0 0.905882 0 0 0 0 0.937255 0 0 0 0.8 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
        <filter
          id="dashboard-bidding-figma-drawer-front-shadow"
          x="7"
          y="109"
          width="428"
          height="129"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="8" />
          <feGaussianBlur stdDeviation="11" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.890196 0 0 0 0 0.905882 0 0 0 0 0.937255 0 0 0 0.8 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
        <filter
          id="dashboard-bidding-figma-new-front-shadow"
          x="2.49219"
          y="33.5965"
          width="1484.01"
          height="417.327"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="18.9056" />
          <feGaussianBlur stdDeviation="30" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.818917 0 0 0 0 0.853392 0 0 0 0 0.922345 0 0 0 0.5 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
        <filter
          id="dashboard-bidding-figma-new-lip-shadow"
          x="27.0325"
          y="27.4128"
          width="1436.11"
          height="103.439"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="-11.816" />
          <feGaussianBlur stdDeviation="17.724" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
        <filter
          id="dashboard-bidding-figma-new-handle-inner"
          x="579.244"
          y="185.277"
          width="331.433"
          height="82.2901"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="4.72639" />
          <feGaussianBlur stdDeviation="5.90799" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.821404 0 0 0 0 0.854584 0 0 0 0 0.904353 0 0 0 1 0" />
          <feBlend mode="normal" in2="shape" result="effect1_innerShadow" />
        </filter>
        <filter
          id="dashboard-bidding-figma-drawer-lip-shadow"
          x="12"
          y="101"
          width="418"
          height="43.2391"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feMorphology radius="2" operator="dilate" in="SourceAlpha" result="effect1_dropShadow" />
          <feOffset dy="-5" />
          <feGaussianBlur stdDeviation="7.5" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
        <filter
          id="dashboard-bidding-figma-handle-inner"
          x="174"
          y="154.413"
          width="94"
          height="24.174"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2.5" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.560784 0 0 0 0 0.603922 0 0 0 0 0.666667 0 0 0 0.16 0" />
          <feBlend mode="normal" in2="shape" result="effect1_innerShadow" />
        </filter>
        <clipPath id="dashboard-bidding-figma-left-wall-clip">
          <rect width="203.62" height="363.607" fill="white" transform="translate(0 29.0886)" />
        </clipPath>
        <clipPath id="dashboard-bidding-figma-right-wall-clip">
          <rect width="203.62" height="363.607" fill="white" transform="translate(913.38 31.9974)" />
        </clipPath>
        <clipPath id="dashboard-bidding-figma-front-card-clip">
          <rect width="300" height="147" fill="white" transform="translate(71 35)" />
        </clipPath>
      </defs>
    </svg>
  );
};

const BiddingQueryEmpty: React.FC<{ copy: DashboardEmptyCopy }> = ({ copy }) => {
  const [frontCardIndex, setFrontCardIndex] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) return undefined;

    const timer = window.setInterval(() => {
      setFrontCardIndex((current) => (current + 1) % copy.biddingFolderTypes.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [copy.biddingFolderTypes.length]);

  return (
    <div className="dashboard-empty dashboard-enterprise-empty dashboard-bidding-empty">
      <div className="dashboard-enterprise-empty-intro">
        <div className="dashboard-enterprise-empty-kicker">
          <span />
          <strong>{copy.biddingEyebrow}</strong>
          <span />
        </div>
        <p className="dashboard-enterprise-empty-subtitle">
          {copy.biddingSubtitleKeywords.map((keyword) => (
            <strong key={keyword}>{keyword}</strong>
          ))}
        </p>
      </div>

      <div className="dashboard-bidding-drawer-visual" aria-hidden="true">
        <BiddingDrawerFigmaSvg labels={copy.biddingFolderTypes} frontCardIndex={frontCardIndex} />
      </div>
    </div>
  );
};

const IndustryChainEmpty: React.FC<{ copy: DashboardEmptyCopy }> = ({ copy }) => {
  const [focusIndex, setFocusIndex] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) {
      setFocusIndex(1);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setFocusIndex((current) => (current + 1) % copy.industryChainNodes.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [copy.industryChainNodes.length]);

  return (
    <div className="dashboard-empty dashboard-enterprise-empty dashboard-industry-chain-empty">
      <div className="dashboard-enterprise-empty-intro">
        <div className="dashboard-enterprise-empty-kicker">
          <span />
          <strong>{copy.industryChainEyebrow}</strong>
          <span />
        </div>
        <p className="dashboard-enterprise-empty-subtitle">
          {copy.industryChainDimensions.map((dimension) => (
            <strong key={dimension}>{dimension}</strong>
          ))}
        </p>
      </div>

      <div className="dashboard-industry-chain-visual">
        <div className="dashboard-industry-chain-link is-left" aria-hidden="true"><i /></div>
        <div className="dashboard-industry-chain-link is-right" aria-hidden="true"><i /></div>
        {copy.industryChainNodes.map((node, index) => {
          const position = (index - focusIndex + copy.industryChainNodes.length) % copy.industryChainNodes.length;
          return (
            <section
              className="dashboard-industry-chain-card"
              data-position={position}
              data-kind={node.kind}
              aria-label={node.title}
              key={node.title}
            >
              <div className="dashboard-industry-chain-card-head">
                <div className="dashboard-industry-chain-card-icon" aria-hidden="true">
                  {node.kind === 'upstream' && <Truck size={30} strokeWidth={1.8} />}
                  {node.kind === 'core' && <Building2 size={30} strokeWidth={1.8} />}
                  {node.kind === 'downstream' && <UsersRound size={30} strokeWidth={1.8} />}
                </div>
                <h3>{node.title}</h3>
              </div>
              <p>{node.description}</p>
              <div className="dashboard-industry-chain-card-lines" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

type CompanyFilterCriterionKind = DashboardEmptyCopy['companyFilterCriteria'][number]['kind'];

const CompanyFilterCriterionIcon: React.FC<{ kind: CompanyFilterCriterionKind }> = ({ kind }) => {
  if (kind === 'region') return <MapPin size={18} strokeWidth={1.8} />;
  if (kind === 'industry') return <Network size={18} strokeWidth={1.8} />;
  return <ShieldCheck size={18} strokeWidth={1.8} />;
};

const CompanyFilterEmpty: React.FC<{ copy: DashboardEmptyCopy }> = ({ copy }) => (
  <div className="dashboard-empty dashboard-enterprise-empty dashboard-company-filter-empty">
    <div className="dashboard-enterprise-empty-intro">
      <div className="dashboard-enterprise-empty-kicker">
        <span />
        <strong>{copy.companyFilterEyebrow}</strong>
        <span />
      </div>
      <p className="dashboard-enterprise-empty-subtitle">
        {copy.companyFilterDimensions.map((dimension) => (
          <strong key={dimension}>{dimension}</strong>
        ))}
      </p>
    </div>

    <div className="dashboard-company-filter-visual" aria-hidden="true">
      <div className="dashboard-company-filter-criteria">
        {copy.companyFilterCriteria.map((criterion) => (
          <span className="dashboard-company-filter-criterion" data-kind={criterion.kind} key={criterion.title}>
            <span className="dashboard-company-filter-criterion-icon">
              <CompanyFilterCriterionIcon kind={criterion.kind} />
            </span>
            <span className="dashboard-company-filter-criterion-label">{criterion.title}</span>
          </span>
        ))}
      </div>

      <div className="dashboard-company-filter-flow">
        <svg viewBox="0 0 560 336" preserveAspectRatio="none" focusable="false">
          <path className="dashboard-company-filter-flow-base is-region" d="M88 270V248Q88 236 100 236H268Q280 236 280 224V212" />
          <path className="dashboard-company-filter-flow-base is-qualification" d="M280 34V88" />
          <path className="dashboard-company-filter-flow-base is-industry" d="M472 270V248Q472 236 460 236H292Q280 236 280 224V212" />
          <path className="dashboard-company-filter-flow-active is-region" pathLength="100" d="M88 270V248Q88 236 100 236H268Q280 236 280 224V214" />
          <path className="dashboard-company-filter-flow-active is-qualification" pathLength="100" d="M280 34V88" />
          <path className="dashboard-company-filter-flow-active is-industry" pathLength="100" d="M472 270V248Q472 236 460 236H292Q280 236 280 224V214" />
        </svg>
      </div>

      <section className="dashboard-company-filter-target" aria-label={copy.companyFilterTargetTitle}>
        <div className="dashboard-company-filter-target-icon">
          <Building2 size={32} strokeWidth={2} />
        </div>
        <div className="dashboard-company-filter-target-copy">
          <h3>{copy.companyFilterTargetTitle}</h3>
          <div className="dashboard-company-filter-target-detail">
            <div className="dashboard-company-filter-target-tags">
              {copy.companyFilterTargetTags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="dashboard-company-filter-target-fields" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
);

const EnterpriseRiskOverviewPanel: React.FC<{ title: string }> = ({ title }) => (
  <div className="dashboard-enterprise-risk-panel is-overview">
    <div className="dashboard-enterprise-risk-panel-title">
      <span>{title}</span>
      <i />
    </div>
    <div className="dashboard-enterprise-risk-overview-signal">
      <svg viewBox="0 0 300 150" focusable="false">
        <path className="is-guide" d="M150 12V138M24 75H276" />
        <ellipse className="is-orbit is-orbit-outer" cx="150" cy="75" rx="112" ry="44" transform="rotate(-12 150 75)" />
        <ellipse className="is-orbit is-orbit-inner" cx="150" cy="75" rx="72" ry="28" transform="rotate(-12 150 75)" />
        <circle className="is-node" cx="48.5" cy="93.6" r="6" transform="rotate(-12 150 75)" />
        <circle className="is-node" cx="255.2" cy="90" r="6" transform="rotate(-12 150 75)" />
        <circle className="is-node" cx="84.7" cy="63.2" r="5" transform="rotate(-12 150 75)" />
        <circle className="is-node" cx="215.3" cy="63.2" r="5" transform="rotate(-12 150 75)" />
        <circle className="is-focus-halo" cx="150" cy="75" r="18" />
        <circle className="is-focus" cx="150" cy="75" r="7" />
      </svg>
      <div className="dashboard-enterprise-risk-overview-metrics">
        {[0, 1, 2].map((row) => (
          <span key={row}>
            <i />
            <b />
          </span>
        ))}
      </div>
    </div>
  </div>
);

const EnterpriseRiskLitigationPanel: React.FC<{ title: string }> = ({ title }) => (
  <div className="dashboard-enterprise-risk-panel is-litigation">
    <div className="dashboard-enterprise-risk-panel-title">
      <span>{title}</span>
      <i />
    </div>
    <div className="dashboard-enterprise-risk-litigation-line">
      <svg viewBox="0 0 312 132" preserveAspectRatio="xMidYMid meet" focusable="false">
        <g transform="translate(0 10)">
        <g className="is-bars" transform="translate(0 8)">
          <rect x="24" y="92" width="7" height="18" rx="1.5" />
          <rect x="38" y="82" width="7" height="28" rx="1.5" />
          <rect x="52" y="96" width="7" height="14" rx="1.5" />
          <rect x="82" y="94" width="7" height="16" rx="1.5" />
          <rect x="96" y="78" width="7" height="32" rx="1.5" />
          <rect x="110" y="93" width="7" height="17" rx="1.5" />
          <rect x="144" y="92" width="7" height="18" rx="1.5" />
          <rect x="158" y="68" width="7" height="42" rx="1.5" />
          <rect x="172" y="90" width="7" height="20" rx="1.5" />
          <rect x="204" y="88" width="7" height="22" rx="1.5" />
          <rect x="218" y="78" width="7" height="32" rx="1.5" />
          <rect x="232" y="93" width="7" height="17" rx="1.5" />
          <rect x="266" y="90" width="7" height="20" rx="1.5" />
          <rect x="280" y="70" width="7" height="40" rx="1.5" />
        </g>
        <path className="is-axis" d="M18 110H296" transform="translate(0 8)" />
        <g className="is-trend" transform="translate(0 -6)">
        <path className="is-base" d="M24 66L75 44L126 62L177 20L228 48L288 60" />
        <path className="is-active" d="M24 66L75 44L126 62L177 20L228 48L288 60" pathLength="100" />
        <circle className="is-dot is-step-1" cx="24" cy="66" r="4" />
        <circle className="is-dot is-step-2" cx="75" cy="44" r="4" />
        <circle className="is-dot is-step-3" cx="126" cy="62" r="4" />
        <circle className="is-halo" cx="177" cy="20" r="18" />
        <circle className="is-dot is-focus is-step-4" cx="177" cy="20" r="4.8" />
        <circle className="is-dot is-step-5" cx="228" cy="48" r="4" />
        <circle className="is-dot is-step-6" cx="288" cy="60" r="4" />
        </g>
        </g>
      </svg>
    </div>
    <div className="dashboard-enterprise-risk-litigation-lines">
      <span>
        <i />
        <b />
      </span>
      <span>
        <i />
        <b />
      </span>
    </div>
  </div>
);

const operationRiskSectors = [
  { path: 'M21 65A48 48 0 0 1 69 17L69 41A24 24 0 0 0 45 65Z' },
  { path: 'M69 21A44 44 0 0 1 113 65L93 65A24 24 0 0 0 69 41Z' },
  { path: 'M119 65A50 50 0 0 1 69 115L69 89A24 24 0 0 0 93 65Z' },
  { path: 'M69 103A38 38 0 0 1 31 65L45 65A24 24 0 0 0 69 89Z' },
] as const;

const EnterpriseRiskOperationPanel: React.FC<{
  isActive: boolean;
  tags: readonly string[];
  title: string;
}> = ({ isActive, tags, title }) => {
  const [activeDimension, setActiveDimension] = React.useState(0);
  const softDimension = (activeDimension + 1) % operationRiskSectors.length;

  React.useEffect(() => {
    if (!isActive) {
      setActiveDimension(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveDimension((current) => (current + 1) % operationRiskSectors.length);
    }, 1400);

    return () => window.clearInterval(timer);
  }, [isActive]);

  return (
    <div className="dashboard-enterprise-risk-panel is-operation">
      <div className="dashboard-enterprise-risk-panel-title">
        <span>{title}</span>
        <i />
      </div>
      <div className="dashboard-enterprise-risk-operation-distribution">
        <svg viewBox="0 0 138 132" focusable="false">
          {operationRiskSectors.map((sector, index) => (
            <path
              className={`is-sector ${index === activeDimension ? 'is-active' : index === softDimension ? 'is-soft' : index === (activeDimension + 2) % operationRiskSectors.length ? 'is-gray-light' : 'is-gray-dark'}`}
              d={sector.path}
              key={sector.path}
            />
          ))}
          <circle className="is-sector-center" cx="69" cy="65" r="17" />
        </svg>
        <div className="dashboard-enterprise-risk-operation-dimensions">
          {tags.slice(0, 4).map((tag, index) => (
            <span className={`is-dimension-${index}${index === activeDimension ? ' is-active' : ''}`} key={tag}>
              <i />
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const EnterpriseRiskCardFace: React.FC<{
  children: React.ReactNode;
  face: 'overview' | 'litigation' | 'operation';
  scanStatus: string;
  side?: 'front' | 'back';
}> = ({ children, face, scanStatus, side = 'front' }) => (
  <section className={`dashboard-enterprise-risk-card is-${face} is-${side}`} aria-label={scanStatus}>
    <div className="dashboard-enterprise-risk-card-head">
      <span className="dashboard-enterprise-risk-card-state">{scanStatus}</span>
    </div>

    <div className="dashboard-enterprise-risk-surface">
      {children}
    </div>
  </section>
);

const EnterpriseRiskEmpty: React.FC<{ copy: DashboardEmptyCopy }> = ({ copy }) => {
  const [overviewTitle, litigationTitle, operationTitle] = copy.enterpriseRiskPanelTitles;
  const [activePanel, setActivePanel] = React.useState(0);
  const [isFlipping, setIsFlipping] = React.useState(false);
  const nextPanel = (activePanel + 1) % 3;

  const faces = ['overview', 'litigation', 'operation'] as const;

  const renderPanel = (panel: number, isActive: boolean) => {
    if (panel === 0) return <EnterpriseRiskOverviewPanel title={overviewTitle} />;
    if (panel === 1) return <EnterpriseRiskLitigationPanel title={litigationTitle} />;
    return (
      <EnterpriseRiskOperationPanel
        isActive={isActive}
        tags={copy.enterpriseRiskTags}
        title={operationTitle}
      />
    );
  };

  const finishFlip = React.useCallback(() => {
    setActivePanel((current) => (current + 1) % faces.length);
    setIsFlipping(false);
  }, [faces.length]);

  React.useEffect(() => {
    const timer = window.setTimeout(
      () => (isFlipping ? finishFlip() : setIsFlipping(true)),
      isFlipping ? 900 : 3800,
    );

    return () => window.clearTimeout(timer);
  }, [finishFlip, isFlipping]);

  return (
    <div className="dashboard-empty dashboard-enterprise-empty dashboard-enterprise-risk-empty">
      <div className="dashboard-enterprise-empty-intro">
        <div className="dashboard-enterprise-empty-kicker">
          <span />
          <strong>{copy.enterpriseRiskEyebrow}</strong>
          <span />
        </div>
        <p className="dashboard-enterprise-empty-subtitle">
          {copy.enterpriseRiskDimensions.map((dimension) => (
            <strong key={dimension}>{dimension}</strong>
          ))}
        </p>
      </div>

      <div className="dashboard-enterprise-risk-visual" aria-hidden="true">
        <div className={`dashboard-enterprise-risk-card-stage${isFlipping ? ' is-flipping' : ''}`}>
          <div
            className="dashboard-enterprise-risk-card-flipper"
            onAnimationEnd={(event) => {
              if (event.animationName === 'dashboard-enterprise-risk-card-flip') finishFlip();
            }}
          >
            <EnterpriseRiskCardFace face={faces[activePanel]} scanStatus={copy.enterpriseRiskScanStatus}>
              {renderPanel(activePanel, true)}
            </EnterpriseRiskCardFace>
            <EnterpriseRiskCardFace face={faces[nextPanel]} scanStatus={copy.enterpriseRiskScanStatus} side="back">
              {renderPanel(nextPanel, false)}
            </EnterpriseRiskCardFace>
          </div>
        </div>
      </div>
    </div>
  );
};

const BatchQueryEmpty: React.FC<{ copy: DashboardEmptyCopy }> = ({ copy }) => {
  const [isAnimated, setIsAnimated] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsAnimated(true);
    }, 520);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="dashboard-empty dashboard-enterprise-empty dashboard-batch-query-empty">
      <div className="dashboard-enterprise-empty-intro">
        <div className="dashboard-enterprise-empty-kicker">
          <span />
          <strong>{copy.batchQueryEyebrow}</strong>
          <span />
        </div>
        <p className="dashboard-enterprise-empty-subtitle">
          {copy.batchQueryDimensions.map((dimension) => (
            <strong key={dimension}>{dimension}</strong>
          ))}
        </p>
      </div>

      <div className={`dashboard-batch-query-visual${isAnimated ? ' is-animated' : ''}`} aria-hidden="true">
        <div className="dashboard-batch-query-glow" />
        <div className="dashboard-batch-query-cursor" />
        <div className="dashboard-batch-query-folder">
          <img
            className="dashboard-batch-query-folder-closed"
            src="/icons/dashboard/batch-folder-closed.svg?v=20260706-batch-folder-rounded-v1"
            alt=""
          />
          <img
            className="dashboard-batch-query-folder-back"
            src="/icons/dashboard/batch-folder-back.svg?v=20260706-batch-folder-colors-v1"
            alt=""
          />
          <div className="dashboard-batch-query-folder-slot" />
          <div className="dashboard-batch-query-card-stack">
            <div className="dashboard-batch-query-paper">
              <img
                className="dashboard-batch-query-paper-file-icon"
                src="/icons/dashboard/file-3-fill.svg?v=20260707"
                alt=""
              />
              <strong>{copy.batchQueryUploadFileName}</strong>
              <i />
              <i />
              <i />
            </div>
          </div>
          <img
            className="dashboard-batch-query-folder-front"
            src="/icons/dashboard/batch-folder-front.svg?v=20260706-batch-folder-rounded-v1"
            alt=""
          />
          <div className="dashboard-batch-query-folder-edge" />
          <div className="dashboard-batch-query-scan" />
        </div>
        <div className="dashboard-batch-query-form-preview">
          <strong>{copy.batchQueryResultTitle}</strong>
          <span className="dashboard-batch-query-form-head">
            <i />
            <i />
            <i />
            <i />
          </span>
          {[0, 1, 2, 3].map((row) => (
            <span className={`dashboard-batch-query-form-row is-row-${row + 1}`} key={row}>
              <i />
              <i />
              <i />
              <i />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export const DashboardEmpty: React.FC = () => {
  const copy = useDashboardEmptyCopy();
  const dashboards = useDashboardStore((s) => s.dashboards);
  const currentKey = useDashboardStore((s) => s.currentKey);

  // 不调用 getCurrentSchema()：该方法每次返回新数组引用，会导致任何 store 变动都触发重渲染。
  // 改为从已订阅的 dashboards + currentKey 直接推导，useMemo 保证引用稳定。
  const currentBoard = dashboards.find((d) => d.key === currentKey);
  const boardName = currentBoard?.name ?? copy.fallbackBoardName;
  const requiredFields = useMemo(() => {
    const schema = (currentBoard?.inputs ?? []) as Array<{ name: string; label?: string; required?: boolean }>;
    return schema.filter((f) => f.required);
  }, [currentBoard]);

  if (currentBoard?.key === 'enterprise-360') {
    return <Enterprise360Empty copy={copy} />;
  }

  if (currentBoard?.key === 'batch-query') {
    return <BatchQueryEmpty copy={copy} />;
  }

  if (currentBoard?.key === 'industry-chain') {
    return <IndustryChainEmpty copy={copy} />;
  }

  if (currentBoard?.key === 'company-filter') {
    return <CompanyFilterEmpty copy={copy} />;
  }

  if (currentBoard?.key === 'enterprise-risk') {
    return <EnterpriseRiskEmpty copy={copy} />;
  }

  if (currentBoard?.key === 'bidding-query' || currentBoard?.key === 'bidding') {
    return <BiddingQueryEmpty copy={copy} />;
  }

  return (
    <div className="dashboard-empty">
      <div className="dashboard-empty-icon">
        <EmptyIllustration />
      </div>
      <div className="dashboard-empty-title">{boardName}</div>
      <div className="dashboard-empty-hint">
        {copy.genericHint}
      </div>
      {requiredFields.length > 0 && (
        <div className="dashboard-empty-fields">
          {requiredFields.map((f) => (
            <span key={f.name} className="dashboard-empty-field-chip">
              {f.label ?? f.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
