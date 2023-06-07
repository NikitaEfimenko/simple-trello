import React, { useCallback, useMemo, useState, useRef } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { createPortal } from 'react-dom';
import { BsFillArrowRightSquareFill, BsFillAlarmFill, BsFillCalendarPlusFill, BsListTask, BsFillCalendarCheckFill } from "react-icons/bs";

import { v4 as uuid } from 'uuid';
import { create } from 'zustand';
import { persist, createJSONStorage } from "zustand/middleware"

const useTaskTracker = create(
  persist(
    (set, get) => ({
      tasks: [],
      create: ({ title, description }) => {

        set({
          tasks: [{
            id: uuid(),
            title,
            description,
            status: Status.backlog
          }, ...get().tasks]
        })
      },
      update: (taskId, listId) => {
        set({
          tasks: get().tasks.map(task => task.id === taskId ? { ...task, status: listId } : task)
        })
      },
      remove: (taskId) => {
        set({
          tasks: get().tasks.filter(task => taskId !== task.id)
        })
      }
    }),
    {
      name: "task-tracker-store",
      storage: createJSONStorage(() => localStorage)
    }
  )
)

useTaskTracker.subscribe(console.log)

const createTaskTitle = "Новая задача"

const List = ({ children, listId, onDrop }) => {
  const [{ isOver }, drop] = useDrop({
    accept: 'item',
    drop: (item) => onDrop(item.id, listId),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  return (
    <ul ref={drop} className={`flex flex-col gap-4 ${isOver ? 'opacity-30' : ''}`}>
      {children}
    </ul>
  );
};

const Item = ({ id, children }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'item',
    item: { id },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  return (
    <li ref={drag} className={`${isDragging ? 'ring-4' : ''}`}>
      {children}
    </li>
  );
};

const App = () => {
  const { tasks, create, update, remove } = useTaskTracker()

  const dropHandler = useCallback((status) => (taskId, _) => {
    update(taskId, status)
  }, [update])

  const taskFilter = useCallback((tasks, status) => {
    const result = tasks.filter(task => task.status === status)
    return result.length > 0 ? result : [{
      id: uuid(),
      status: Status.empty
    }]
  }, [])

  const taskFilterList = useCallback((status) => {
    return taskFilter(tasks, status).map(task => {
      return <Item id={task.id}>
        <Card onUpdate={(_status) => update(task.id, _status)} onRemove={() => remove(task.id)} title={task.title} description={task.description} status={task.status} />
      </Item>
    })
  }, [tasks, taskFilter])

  const [backlogCount, inworkCount, doneCount, percent] = useMemo(() => {
    let backlogCounter = 0
    let inworkCounter = 0
    let doneCounter = 0
    for (let task of tasks) {
      switch (task.status) {
        case Status.backlog: {
          backlogCounter += 1;
          break;
        }
        case Status.inwork: {
          inworkCounter += 1;
          break;
        }
        case Status.done: {
          doneCounter += 1;
          break;
        }
        default: {

        }
      }
    }
    const percent = doneCounter / (backlogCounter + doneCounter + inworkCounter) * 100
    return [backlogCounter, inworkCounter, doneCounter, isNaN(percent) ? 0 : percent.toFixed(1)]
  }, [tasks])

  const [taskTitle, setTaskTitle] = useState("")
  const [taskDescription, setTaskDescription] = useState("")

  return (
    <>
      <div className="flex flex-col  items-center justify-center h-screen overflow-auto gap-12">
        <div className="flex gap-6 items-center">
          <label className="btn" onClick={() => window?.[createTaskTitle].showModal()} >
            Добавить задачу
            <BsFillCalendarPlusFill size={16} />
          </label>
          <Modal title={createTaskTitle} body={
            <div className="card relative bg-transparent">
              <div class="card-body py-3 px-4 ">
                <input value={taskTitle} autoFocus onChange={e => setTaskTitle(e.target.value)} type="text" placeholder="Название задачи" className="input input-bordered input-accent w-full max-w-xs" />
                <textarea value={taskDescription} onChange={e => setTaskDescription(e.target.value)} placeholder="Описание задачи" className="textarea textarea-bordered textarea-md w-full max-w-xs" rows={5} ></textarea>
                <div class="card-actions justify-start w-full gap-6 flex">
                  <button type='button' onClick={(e) => {
                    e.preventDefault()
                    create({
                      title: taskTitle,
                      description: taskDescription
                    })
                    setTaskDescription("")
                    setTaskTitle("")
                    window?.[createTaskTitle].close()
                  }} className="btn btn-success btn-outline">Создать</button>
                </div>
              </div>
            </div>
          } />
          <div className="stats shadow">
            <div className="stat">
              <div className="stat-figure text-secondary">
                <BsListTask size={48} />
              </div>
              <div className="stat-title">{Status.backlog}</div>
              <div className="stat-value">{backlogCount}</div>
              <div className="stat-desc">Поставленные задачи</div>
            </div>

            <div className="stat">
              <div className="stat-figure text-secondary">

                <BsFillAlarmFill size={48} />
              </div>
              <div className="stat-title">{Status.inwork}</div>
              <div className="stat-value">{inworkCount}</div>
              <div className="stat-desc">Список задач в работе</div>
            </div>

            <div className="stat">
              <div className="stat-figure text-secondary">
                <BsFillCalendarCheckFill size={48} />
              </div>
              <div className="stat-title">{Status.done}</div>
              <div className="stat-value">{doneCount}</div>
              <div className="stat-desc">Сколько выполнено</div>
            </div>

          </div>
          <div className="radial-progress bg-primary text-primary-content border-4 border-primary" style={{ "--value": percent }}>{percent}%</div>
        </div>
        <DndProvider backend={HTML5Backend}>
          <div className="flex flex-col w-full container shadow-md lg:flex-row">
            <div className="grid flex-grow overflow-scroll h-[540px] card paper rounded-box place-items-center gap-12 py-3">
              <List listId={Status.backlog} onDrop={dropHandler(Status.backlog)}>
                {
                  <>{taskFilterList(Status.backlog)}</>
                }
              </List>
            </div>
            <div className="divider lg:divider-horizontal"><BsFillArrowRightSquareFill size={96} /></div>
            <div className="grid flex-grow overflow-auto h-[540px] card paper rounded-box place-items-center gap-12 py-3">
              <List listId={Status.inwork} onDrop={dropHandler(Status.inwork)}>
                {
                  <>{taskFilterList(Status.inwork)}</>
                }
              </List>
            </div>
            <div className="divider lg:divider-horizontal"><BsFillArrowRightSquareFill size={96} /></div>
            <div className="grid flex-grow overflow-auto h-[540px]  card paper rounded-box place-items-center gap-12 py-3">
              <List listId={Status.done} onDrop={dropHandler(Status.done)}>
                {
                  <>{taskFilterList(Status.done)}</>
                }
              </List>
            </div>
          </div>
        </DndProvider>
      </div>
    </>
  );
};

const Status = {
  backlog: "Backlog",
  inwork: "В работе",
  done: "Выполнено",
  empty: "Пусто"
}
const getColorFromStatus = (status) => {
  switch (status) {
    case Status.backlog: return "badge-default"
    case Status.inwork: return "badge-info"
    case Status.done: return "badge-success"
  }
}

const Card = ({ title, description, onRemove, status = Status.done, onUpdate }) => {
  const isEmpty = status === Status.empty
  return <div class="card relative w-64 bg-base-100 shadow-xl image-full">
    <figure><img src={!isEmpty ? "/bg.jpg" : "/empty.jpeg"} alt="image" /></figure>
    <div class="card-body py-3 px-4">
      <h2 class="card-title mt-6">{!isEmpty ? title : "Пусто"}</h2>
      <p>{description}</p>
      {!isEmpty && <div class="card-actions justify-center w-full gap-6 flex">
        <div className="dropdown dropdown-top">
          <div className={`badge badge-accent ${getColorFromStatus(status)}`}>{status}</div>
          <label tabIndex={0} className="btn btn-xs m-1 btn-outline">Изменить</label>
          <ul tabIndex={0} className="dropdown-content menu p-1 shadow bg-base-100 w-full rounded-box">
            <li><button onClick={() => onUpdate(Status.backlog)}>{Status.backlog}</button></li>
            <li><button onClick={() => onUpdate(Status.inwork)}>{Status.inwork}</button></li>
            <li><button onClick={() => onUpdate(Status.done)}>{Status.done}</button></li>
            <li><button onClick={onRemove}>Удалить</button></li>
          </ul>
        </div>
      </div>
}
    </div>
  </div>
}


const Modal = ({ title, body }) => {
  return <dialog id={title} className="modal">
    <form method="dialog" className="modal-box max-w-sm">
      <button htmlFor={title} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
      <h3 className="font-bold text-lg">{title}</h3>
      <div className="block">
        {body}
      </div>
    </form>
    <form method="dialog" className="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
}

export default App;

