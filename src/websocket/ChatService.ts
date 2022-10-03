import { response } from "express";
import { container } from "tsyringe";
import { io } from "../http";
import { CreateChatRoomService } from "../services/createChatRoom/CreateChatRoomService";
import { CreateMessageService } from "../services/CreateMessage/CreateMessageService";
import { CreateUserService } from "../services/createUser/CreateUserService";
import { GetAllUsersService } from "../services/getAllUsersService/GetAllUsersService";
import { GetChatRoomByIdService } from "../services/getChatRoom/GetChatRoomByIdService";
import { GetChatRoomByUsersService } from "../services/getChatRoom/GetChatRoomByUsersService";
import { GetMessagesByChatRoomService } from "../services/getMessages/GetMessagesByChatRoomService";
import { GetUserBySocketIdService } from "../services/getUserBySocker/GetUserBySocketIdService";



io.on("connect", socket => {


  socket.on("start", async (data) => {
    const { email, avatar, name } = data;
    const createUserService = container.resolve(CreateUserService);

    const user = await createUserService.execute(
      {
        email,
        avatar,
        name,
        socket_id: socket.id
      });


    socket.broadcast.emit("new_users", user);

  });

  socket.on("get_users", async (callback) => {
    const getAllUsersService = container.resolve(GetAllUsersService);

    const users = await getAllUsersService.execute();

    callback(users);

  });


  socket.on("start_chat", async (data, callback) => {
    const createChatRoomService = container.resolve(CreateChatRoomService);
    const getUserBySocketIdService = container.resolve(GetUserBySocketIdService);
    const getChatRoomByUsersService = container.resolve(GetChatRoomByUsersService);
    const getMessagesByChatRoomService = container.resolve(GetMessagesByChatRoomService);


    const userLogged = await getUserBySocketIdService.execute(socket.id);

    let room = await getChatRoomByUsersService.execute([data.idUser, userLogged._id]);

    if (!room) {
      room = await createChatRoomService.execute([data.idUser, userLogged._id]);
    }

    socket.join(room.idChatRoom);

    //Buscar mensagens da sala

    const messages = await getMessagesByChatRoomService.execute(room.idChatRoom);


    callback({ room, messages });
  });


  socket.on("message", async (data) => {
    // Buscas as informações do usuário (socker.id)

    const getUserBySocketIdService = container.resolve(GetUserBySocketIdService);
    const createMessageService = container.resolve(CreateMessageService);
    const getChatRoomByIdService = container.resolve(GetChatRoomByIdService);

    const user = await getUserBySocketIdService.execute(socket.id);

    //Salvar a mensagem

    const message = await createMessageService.execute({
      to: user._id,
      text: data.message,
      roomId: data.idChatRoom
    });

    //Enviar a mensagem para outros usuários da sala
    io.to(data.idChatRoom).emit("message", {
      message,
      user,
    });



    // Enviar notificação para o usuário correto
    const room = await getChatRoomByIdService.execute(data.idChatRoom);

    const userFrom = room.idUsers.find((response) => String(response._id) != String(user._id));


    io.to(userFrom.socket_id).emit("notification", {
      newMessage: true,
      roomId: data.idChatRoom,
      from: user
    });


  });

});