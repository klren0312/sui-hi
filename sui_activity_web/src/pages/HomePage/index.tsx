import { UsergroupAddOutlined } from '@ant-design/icons'
import { useSignAndExecuteTransaction, useSuiClient, useSuiClientQuery } from '@mysten/dapp-kit'
import { Badge, Button, Card, Carousel, Descriptions, Divider, Image, message, Modal, Tag } from 'antd'
import { SUI_HAI_SERVER } from '/@/utils/constants'
import { useEffect, useState } from 'react'
import { useNetworkVariable } from '/@/utils/networkConfig'
import { useUserStore } from '/@/stores/user'
import { Transaction } from '@mysten/sui/transactions'
import dayjs from 'dayjs'
const { Meta } = Card

// 服务器数据类型
interface ServerData {
  activity_fee: string
  activity_max_join_fee: string
  id: {
    id: string
  }
  members: {
    type: string
    fields: {
      id: {
        id: string
      }
      size: string
    }
  }
  name: string
  pool_balance: string
}

interface ActivityData {
  date_range: string[]
  description: string
  id: {
    id: string
  }
  join_fee: string
  join_memeber: {
    type: string
    fields: {
      contents: string[]
    }
  }
  location: string
  media: string[]
  tag: string
  title: string
  total_people_num: string
  total_price: string
}

function HomePage () {
  const packageId = useNetworkVariable('packageId')
  const client = useSuiClient()
  const [serverData, setServerData] = useState<ServerData>()
  const [activityData, setActivityData] = useState<ActivityData[]>([])
  const [serverDataLoading, setServerDataLoading] = useState(false)
  const { userData, joinActivityIdList, activityListRefetch } = useUserStore()
  const { mutate } = useSignAndExecuteTransaction()
  const [messageApi, contextHolder] = message.useMessage()
  const [activityDetailModalOpen, setActivityDetailModalOpen] = useState(false)
  const [activityDetailData, setActivityDetailData] = useState<ActivityData>()

  /**
   * 查询注册事件
   */
  const {
    data: registerEvents,
  } = useSuiClientQuery(
    "queryEvents",
    {
      query: {
        MoveModule: {
          package: packageId,
          module: "sui_hai",
        },
      },
      order: "descending",
    },
    {
      refetchInterval: 10000,
    }
  )

  /**
   * 查询活动创建事件
   */
  const {
    data: activityEvents,
  } = useSuiClientQuery(
    'queryEvents',
    {
      query: {
        MoveEventType:  `${packageId}::activity::CreateActivityEvent`,
      },
      order: "descending",
    },
    {
      refetchInterval: 10000,
    }
  )

  const { data: multiActivityObjects } = useSuiClientQuery(
    "multiGetObjects",
    {
      ids:
        activityEvents?.data.map((item) => (item.parsedJson as any).activity_id as string) || [],
      options: {
        showContent: true,
      },
    },
    {
      enabled:
        activityEvents &&
        activityEvents.data.length > 0,
      refetchInterval: 10000,
    }
  )

  useEffect(() => {
    if (multiActivityObjects && multiActivityObjects.length > 0) {
      const formatArr = multiActivityObjects.map(item => {
        if (item.data && item.data.content && item.data.content.dataType === 'moveObject') {
          return item.data.content.fields as unknown as ActivityData
        }
        return undefined
      }).filter(item => item) as unknown as ActivityData[]
      console.log('formatArr', formatArr)
      setActivityData(formatArr)

    }
  }, [multiActivityObjects])

  /**
   * 根据注册事件更新服务器数据
   */
  useEffect(() => {
    if (registerEvents && registerEvents.data.length > 0) {
      getServerData()
    }
  }, [registerEvents])

  /**
   * 初始化时获取服务器数据
   */
  useEffect(() => {
    getServerData()
  }, [])
  /**
   * 获取服务器数据
   */
  const getServerData = async () => {
    setServerDataLoading(true)
    const { data: sdata, error } = await client.getObject({
      id: SUI_HAI_SERVER,
      options: {
        showContent: true
      }
    })
    if (error) {
      console.error(error)
    } else {
      if (sdata && sdata.content?.dataType === 'moveObject') {
        setServerData(sdata.content.fields as unknown as ServerData)
      }
    }
    setServerDataLoading(false)
  }

  /**
   * 参加活动
   */
  const joinActivity = (activityId: string, joinFee: string) => {
    const txb = new Transaction()
    const [coin] = txb.splitCoins(txb.gas, [BigInt(joinFee)])
    txb.moveCall({
      target: `${packageId}::activity::join_activity`,
      arguments: [
        txb.object(userData.objectId),
        txb.object(activityId),
        coin,
        txb.pure.string(dayjs().format('YYYY-MM-DD HH:mm:ss')),
      ]
    })
    mutate(
      {
        transaction: txb,
      },
      {
        onError(error) {
          console.error(error.message)
          messageApi.error(error.message)
        },
        onSuccess(result) {
          messageApi.success(`参加活动成功: ${result.digest}`)
          activityListRefetch()
        }
      }
    )
  }
  const openActivityDetails = (activity: ActivityData) => {
    setActivityDetailModalOpen(true)
    setActivityDetailData(activity)
  }
  return (
    <div className="flex flex-col">
      {contextHolder}
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          {
            serverDataLoading ?
            <div>加载中...</div> :
            <div className="flex">
              <Tag color="#2db7f5">总用户数：{serverData?.members.fields.size} 人</Tag>
              <Tag color="#2db7f5">系统资金池：{serverData?.pool_balance ? parseInt(serverData.pool_balance) / 1000000000 : 0} SUI</Tag>
            </div>
          }
        </div>
      </div>
      <Divider />
      <div className="grid grid-cols-5 gap-5">
        {
          activityData.map((item, index) => (
            <Badge.Ribbon
              key={index}
              color={parseInt(item.join_fee) === 0 ? 'green' : 'volcano'}
              text={
                <div>
                  <div>{item.tag + (parseInt(item.join_fee) === 0 ? '（免费）' : '（收费）')}</div>
                  <div>{item.date_range[0]} - {item.date_range[1]}</div>
                </div>
              }
            >
              {/* 活动卡片 */}
              {/* 添加点击事件，点击后进入详情弹框 */}
              <Card
                onClick={() => {
                  openActivityDetails(item)
                }}
                hoverable
                cover={
                  <Carousel arrows infinite={false}>
                    {
                      item.media.map((url, index) => (
                        <div key={index}>
                          <Image
                            className="object-cover"
                            width={'100%'}
                            height={200}
                            src={url}
                            fallback="data:image/png;base64,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"
                          />
                        </div>
                      ))
                    }
                  </Carousel>
                }
                actions={[
                  joinActivityIdList && joinActivityIdList.includes(item.id.id) ? 
                  <Button disabled>已参加</Button> :
                  item.join_memeber.fields.contents.length >= parseInt(item.total_people_num) ?
                  <Button color="danger" disabled>已满员</Button> :
                  <Button type="text" onClick={() => joinActivity(item.id.id, item.join_fee)}><UsergroupAddOutlined />
                    立即参加
                    <Tag icon={<img className="w-4 h-4" src='/sui.svg' />} color="#55acee">
                      {parseInt(item.join_fee) === 0 ? '' : `${parseInt(item.join_fee) / 1000000000}`}
                    </Tag>
                  </Button>
                ]}
              >
                <Meta
                  title={
                    <div className="flex justify-between items-center">
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap">{item.title}</div>
                      <div className="text-xs text-gray-500">{item.join_memeber.fields.contents.length} 人 / {item.total_people_num} 人</div>
                    </div>
                  }
                  description={item.description}
                />
              </Card>
            </Badge.Ribbon>
          ))
        }
      </div>
      <Modal
        width={1200}
        open={activityDetailModalOpen}
        onCancel={() => setActivityDetailModalOpen(false)}
        title={activityDetailData?.title + '活动详情'}
        footer={null}
      >
        <Carousel arrows infinite={false}>
          {
            activityDetailData && activityDetailData.media.map((url, index) => (
              <div key={index}>
                <Image
                  className="object-cover"
                  width={'100%'}
                  height={400}
                  src={url}
                  fallback="data:image/png;base64,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"
                />
              </div>
            ))
          }
        </Carousel>
        <Descriptions bordered>
          <Descriptions.Item label="活动名称">{activityDetailData?.title}</Descriptions.Item>
          <Descriptions.Item label="活动标签">{activityDetailData?.tag}</Descriptions.Item>
          <Descriptions.Item label="活动时间">{activityDetailData?.date_range.join(' - ')}</Descriptions.Item>
          <Descriptions.Item label="活动地点">{activityDetailData?.location}</Descriptions.Item>
          <Descriptions.Item label="活动费用">{activityDetailData?.join_fee === '0' ? '免费' : `${parseInt(activityDetailData?.join_fee || '0') / 1000000000}`}</Descriptions.Item>
          <Descriptions.Item label="活动人数">总人数：{activityDetailData?.join_memeber.fields.contents.length} 人 / 上限：{activityDetailData?.total_people_num} 人</Descriptions.Item>
          <Descriptions.Item label="活动描述">{activityDetailData?.description}</Descriptions.Item>
        </Descriptions>
        {
          activityDetailData &&
          <div className="w-full mt-5 flex justify-center">
            {joinActivityIdList && joinActivityIdList.includes(activityDetailData?.id.id) ? 
            <Button disabled>已参加</Button> :
            activityDetailData && activityDetailData.join_memeber.fields.contents.length >= parseInt(activityDetailData.total_people_num) ?
            <Button color="danger" disabled>已满员</Button> :
            <Button type="text" onClick={() => joinActivity(activityDetailData?.id.id, activityDetailData?.join_fee)}><UsergroupAddOutlined />
              立即参加
              <Tag icon={<img className="w-4 h-4" src='/sui.svg' />} color="#55acee">
                {activityDetailData?.join_fee === '0' ? '' : `${parseInt(activityDetailData?.join_fee) / 1000000000}`}
              </Tag>
            </Button>}
          </div>
        }
      </Modal>
    </div>
  )
}

export default HomePage
